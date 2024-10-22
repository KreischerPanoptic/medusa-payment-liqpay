# medusa-payment-liqpay
medusa-payment-liqpay is a Medusa plugin that adds [LiqPay](https://www.liqpay.ua/) as a payment provider to Medusa ecommerce stores.

[Medusa Website](https://medusajs.com/) | [Medusa Repository](https://github.com/medusajs/medusa) | [LiqPay](https://www.liqpay.ua/)

# WARNING

- Work in Progress. **NOT FULLY TESTED YET** Use at your own risk.

## Features

- Adds LiqPay as one of available Payment Processors for Medusa.js

---

# Setup

## Prerequisites

- [LiqPay account](https://www.liqpay.ua/uk/adminbusiness)
- [LiqPay account's public and private keys](https://www.liqpay.ua/doc)
- Medusa server

## Medusa Server

If you don’t have a Medusa server installed yet, you must follow the [quickstart guide](https://docs.medusajs.com/quickstart/quick-start/) first.

### Install the LiqPay Plugin

In the root of your Medusa server, run the following command to install the Paystack plugin:

```bash
yarn add medusa-payment-liqpay
```

### Configure the Paystack Plugin

Next, you need to enable the plugin in your Medusa server.

In `medusa-config.js` add the following to the `plugins` array:

```js
const plugins = [
  // other plugins
  {
    resolve: `medusa-payment-liqpay`,
    /** @type {import("medusa-payment-liqpay").PluginOptions} */
    options: {
      public_key: "<LIQPAY_PUBLIC_KEY>",
      private_key: "<LIQPAY_PRIVATE_KEY>",
    },
  },
];
```

The full list of configuration options you can pass to the plugin can be found in [Config](#configuration)

---

## Admin Setup

This step is required for you to be able to use LiqPay as a payment provider in your storefront.

### Admin Prerequisites

If you don’t have a Medusa admin installed, make sure to follow [the guide on how to install it](https://github.com/medusajs/admin#-quickstart) before continuing with this section.

### Add LiqPay to Regions

You can refer to [this documentation in the user guide](https://docs.medusajs.com/user-guide/regions/providers/#manage-payment-providers) to learn how to add a payment provider like LiqPay to a region.

---

## Storefront Setup

### Next.js API Route Example

```js
import LiqPay from "@lib/util/liqpay"
import { NextResponse } from "next/server"

const liqpay = new LiqPay(
  process.env.LIQPAY_PUBLIC_KEY!,
  process.env.LIQPAY_PRIVATE_KEY!
)

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const data = {
      version: 3,
      public_key: process.env.LIQPAY_PUBLIC_KEY!,
      action: "pay",
      amount: Number.parseFloat(formData.get("amount") as string),
      currency: "UAH",
      description: "Оплата замовлення Medusa Store",
      order_id: formData.get("order_id"),
      language: "uk",
      result_url: "<your_storefront_success_url>",
      server_url: "https://<my_medusa_store_url>/liqpay/webhook",
    }
    return NextResponse.json(liqpay.constructObject(data))
  } catch (error) {
    console.error("LiqPay API Error:", error)
    return NextResponse.json({ error })
  }
}
```

For constructing **data** and **signature** object you can use official LiqPay Node.js SDK (it doesn't support Typescript though):

```npm install liqpay-sdk-nodejs```

### Next.js Payment Button Example

```js
import axios from "axios"
import { Cart, Order } from "@medusajs/medusa"
import { useEffect, useState } from "react"
import {convertToDecimal} from '@lib/util/prices'

const LiqPayCheckout = ({
  cart,
}: {
  cart: Omit<Cart, "refundable_amount" | "refunded_total"> | null
}) => {
  const [order, setOrder] = useState<Order|undefined>()
  const [liqpayData, setLiqpayData] = useState<string | null>(null)
  const [liqpaySignature, setLiqpaySignature] = useState<string | null>(null)
  
  useEffect(() => {
      if (cart?.total) {
        const formData = new FormData()
        formData.append("amount", `${convertToDecimal(cart?.total, cart?.region)}`)
        formData.append("order_id", `${cart?.id}`)
  
        axios
          .post("/api/liqpay", formData)
          .then((result) => {
            setLiqpayData(result.data.data)
            setLiqpaySignature(result.data.signature)
          })
          .catch((error) => {
            console.error("Error fetching LiqPay data:", error)
          })
      }
  }, [cart])

  return (
    <>
      {
        liqpayData && liqpaySignature ?
        <form
        method="POST"
        action="https://www.liqpay.ua/api/3/checkout"
        accept-charset="utf-8"
        className="w-full flex justify-end"
      >
        <input type="hidden" name="data" value={liqpayData || ""} />
        <input type="hidden" name="signature" value={liqpaySignature || ""} />
        <button
          //@ts-ignore
          type="image"
          className="w-1/2 shadow-none bg-[#4EA525] hover:bg-[#4EA52590] rounded-xl h-[32px] text-white transition-all duration-300 mt-6"
        >
          Перейти до оплати
        </button>
      </form>
      : null
      }
      
    </>
  )
}

export default LiqPayCheckout
```

You can modify default function ```convertToDecimal``` from ```@lib/util/prices``` in default Storefront to convert Medusa.js amount to suitable for LiqPay API consumption.

---

## Refund Payments

You can refund captured payments made with LiqPay from the Admin dashboard.

`medusa-payment-liqpay` handles refunding the given amount using LiqPay and marks the order in Medusa as refunded.

---

# Configuration

| Name            | Type      | Default     | Description                                                                                   |
| --------------- | --------- | ----------- | --------------------------------------------------------------------------------------------- |
| public_key      | `string`  | `undefined` | Your LiqPay public key (the short one)           
| private_key      | `string`  | `undefined` | Your LiqPay private key                                                                   |
| disable_retries | `boolean` | `false`     | Disable retries for 5xx and failed idempotent requests to LiqPay                            |
| debug           | `boolean` | `false`     | Enable debug mode for the plugin. If true, helpful debug information is logged to the console |