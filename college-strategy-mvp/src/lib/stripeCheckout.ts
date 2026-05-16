/** 与 Node API 对齐：服务端配齐 Stripe + 本项目 .env 中打开开关后启用结账 */

export function isStripeCheckoutEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_STRIPE_CHECKOUT === "true";
}
