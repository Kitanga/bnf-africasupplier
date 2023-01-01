import { createApp } from 'vue'

function initPayPalButton(app) {
    if (document.querySelector('#paypal-button-container')) {
        document.getElementById('paypal-button-container').innerHTML = ""
    } else {
        return;
    }

    console.log('app fnc:', app?.getOrdersTotal)
    paypal.Buttons({
        style: {
            shape: 'rect',
            color: 'gold',
            layout: 'vertical',
            label: 'checkout',

        },

        createOrder: function (data, actions) {
            // const orders = app.orders.map(order => app.get)
            const purchase_units = app.getPayPalOrders();
            console.log(purchase_units)

            return actions.order.create({
                purchase_units,
                // #region [
                //     {
                //         "description": "Things I want to buy",
                //         "amount": {
                //             "currency_code": "USD",
                //             "value": 11.15,
                //             "breakdown": {
                //                 "item_total": {
                //                     "currency_code": "USD",
                //                     "value": 1
                //                 },
                //                 "shipping": {
                //                     "currency_code": "USD",
                //                     "value": 10
                //                 },
                //                 "tax_total": {
                //                     "currency_code": "USD",
                //                     "value": 0.15
                //                 }
                //             }
                //         }
                //     }
                // #endregion ]
            });
        },

        onApprove: function (data, actions) {
            // return actions.order.capture().then(async function (orderData) {

            // Full available details
            console.log('Data', data);
            // console.log('Capture result', orderData, JSON.stringify(orderData, null, 2));

            // Show a success message within this page, e.g.
            // const element = document.getElementById('paypal-button-container');
            // element.innerHTML = '';
            // element.innerHTML = '<h3>Thank you for your payment!</h3>';

            // Or go to another URL:  actions.redirect('thank_you.html');

            (document.getElementById('preloader') ?? {}).style = "";

            // First tell the server that the payment's been made
            return fetch(`http://localhost:8080/api/orders/${data.orderID}/capture`, {
                method: "POST",
            }).then(resp => resp.json()).then(captureData => {
                console.log('Capture Data:', captureData);
                // When we get response from that we reset localStorage
                localStorage.removeItem('orders')

                // Now redirect to thank you page
                location.href = 'thank-you.html'
            })

            // console.log('Capture Data:', captureData);

            // When we get response from that we reset localStorage
            // localStorage.removeItem('orders')

            // Now redirect to thank you page
            // actions.redirect('thank-you.html');
            // });
        },

        onError: function (err) {
            console.log(err);
        }
    }).render('#paypal-button-container');
}

const initCart = async () => {
    const productDetails = window.productDetails = await fetch('js/products.json').then(resp => resp.json());
    const usdToZar = (await fetch(`https://api.freecurrencyapi.com/v1/latest?apikey=JQZSpbifRSWb9Tthrb2z0hZTuL5XuTeCe38ZXWpL&base_currency=${productDetails.base_currency}&currencies=${productDetails.currency}`).then(resp => resp.json()))?.data?.ZAR ?? 1;
    // console.log('Product details:', productDetails)

    const orders = (JSON.parse(localStorage.getItem('orders')) ?? []).filter(order => !!productDetails.products.find(product => product.productId === order.productId));

    window.app = createApp({
        /**
         * 
         * @returns {{orders: { productId: string; quantity: number; }[]; currency: string; products: { img: string; name: string; price: number; productId: string }}}
         */
        data() {
            return {
                currency: (details => {
                    switch (details.base_currency.toLowerCase()) {
                        case 'usd':
                            return '$';
                        case 'zar':
                            return 'R';
                        default:
                            return '$';
                    }
                })(productDetails),
                base_currency: (details => {
                    switch (details.currency.toLowerCase()) {
                        case 'usd':
                            return '$';
                        case 'zar':
                            return 'R';
                        default:
                            return '$';
                    }
                })(productDetails),
                products: productDetails.products,
                orders: orders ?? [],
                shippingCharge: productDetails.shipping_charge,
                tax: productDetails.tax,
                usdToZar,
            }
        },
        methods: {
            getExchangeRatePrice(price) {
                return `${this.base_currency}${(price * this.usdToZar).toFixed(2)}`
            },
            order(product, increment) {
                const order = this.orders.find(order => order.productId === product.productId);

                if (order) {
                    order.quantity += increment;

                    if (order.quantity <= 0) {
                        const orderIndex = this.orders.findIndex(order => order.productId === product.productId);
                        this.orders.splice(orderIndex, 1);
                    }
                } else {
                    this.orders.push({
                        productId: product.productId,
                        quantity: 1,
                    })
                }

                const newOrders = [...this.orders];
                this.orders = newOrders;

                localStorage.setItem('orders', JSON.stringify(newOrders));
            },
            getOrder(pId) {
                const order = this.orders.find(order => order.productId === pId);

                return order;
            },
            getOrderQuantity(pId) {
                const order = this.getOrder(pId);

                return order?.quantity ?? 0
            },
            getOrderTotal(pId) {
                const order = this.getOrder(pId);
                const product = this.getProduct(pId);

                const quantity = order.quantity ?? 0;
                const price = product.price ?? 0;

                return quantity * price;
            },
            removeOrder(pId) {
                const product = this.getProduct(pId);
                const quantity = this.getOrderTotal(pId);

                this.order(product, -quantity);
            },
            getProduct(pId) {
                const product = this.products.find(product => product.productId === pId);

                return product;
            },
            getProductImage(pId) {
                const product = this.getProduct(pId);

                return product?.img ?? 0
            },
            getProductName(pId) {
                const product = this.getProduct(pId);

                return product?.name ?? ""
            },
            getProductPrice(pId) {
                const product = this.getProduct(pId);

                return product?.price ?? ""
            },
            getOrdersSubtotal() {
                const subTotal = this.orders.map(order => this.getOrderTotal(order.productId)).reduce((prev, curr) => prev + curr, 0);

                return subTotal;
            },
            getOrdersTaxedAmount() {
                return this.getOrdersSubtotal() * this.tax;
            },
            _getOrdersSubtotalWithTax() {
                return this.getOrdersSubtotal() * this.tax;
            },
            getOrdersTotal() {
                return this.getOrdersTaxedAmount() + this.getOrdersSubtotal() + this.shippingCharge;
            },
            getPayPalOrders() {
                const total = this.getOrdersTotal();
                const taxedAmount = this.getOrdersTaxedAmount();
                const currency_code = productDetails.base_currency;

                const paypalOrders = this.orders.map(order => {
                    // First get products
                    const product = this.getProduct(order.productId);

                    const paypalOrder = {
                        name: product.name,
                        quantity: order.quantity.toString(),
                        unit_amount: {
                            currency_code,
                            value: product.price.toFixed(2),
                        },
                        // tax: {
                        //     currency_code,
                        //     value: (order.quantity * this.tax).toFixed(2),
                        // },
                        category: 'PHYSICAL_GOODS',
                    };

                    return paypalOrder;
                });

                const payload = [
                    {
                        amount: {
                            currency_code,
                            value: total.toFixed(2),
                            breakdown: {
                                item_total: {
                                    currency_code,
                                    value: this.getOrdersSubtotal().toFixed(2),
                                },
                                tax_total: {
                                    currency_code,
                                    value: taxedAmount.toFixed(2),
                                },
                                shipping: {
                                    currency_code,
                                    value: this.shippingCharge,
                                },
                            },

                        },
                        items: paypalOrders
                    }
                ];

                console.log('Payload:', payload)

                console.log('check total validity:', total === this.getOrdersSubtotal() + taxedAmount + this.shippingCharge);
                console.log('check subtotal validity:', this.getOrdersSubtotal().toFixed(2) === payload[0].items.map(item => parseInt(item.quantity) * parseFloat(item.unit_amount.value)).reduce((prev, curr) => prev + curr, 0).toFixed(2))
                // console.log('check tax validity:', taxedAmount.toFixed(2), payload[0].items.map(item => parseFloat(item.tax.value)).reduce((prev, curr) => prev + curr, 0).toFixed(2))

                return payload
            },
        },
        mounted() {
            initPayPalButton(this);
            (document.getElementById('products') ?? {}).style = "";
            (document.getElementById('cart') ?? {}).style = "";
            (document.getElementById('preloader') ?? {}).style = "display: none;";
        },
        updated() {
            // initPayPalButton(this);
        }
    }).mount('#app');
}

// initPayPalButton();

initCart()