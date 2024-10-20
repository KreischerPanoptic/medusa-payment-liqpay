import {LiqPayStatusUnion} from "../lib/interfaces/liqpay.interfaces";

export function translateStatus(status?: LiqPayStatusUnion): string {
    switch (status) {
        case 'error':
            return 'Неуспішний платіж. Некоректно заповнені дані';
        case 'failure':
            return 'Неуспішний платіж';
        case 'reversed':
            return 'Платіж повернений';
        case 'subscribed':
            return 'Підписка успішно оформлена';
        case 'unsubscribed':
             return 'Підписка успішно деактивована';
        case 'success':
            return 'Успішний платіж';
        case '3ds_verify':
            return 'Потрібна 3DS верифікація. Для завершення платежу, потрібно виконати 3ds_verify';
        case 'captcha_verify':
            return 'Очікується підтвердження captcha';
        case 'cvv_verify':
            return 'Потрібне введення CVV картки відправника. Для завершення платежу, потрібно виконати cvv_verify'
        case 'ivr_verify':
            return 'Очікується підтвердження дзвінком ivr';
        case 'otp_verify':
            return 'Потрібне OTP підтвердження клієнта. OTP пароль відправлений на номер телефону Клієнта. Для завершення платежу, потрібно виконати otp_verify';
        case 'password_verify':
            return 'Очікується підтвердження пароля додатка Приват24';
        case 'phone_verify':
            return 'Очікується введення телефону клієнтом. Для завершення платежу, потрібно виконати phone_verify';
        case 'pin_verify':
            return 'Очікується підтвердження pin-code';
        case 'receiver_verify':
            return 'Потрібне введення даних одержувача. Для завершення платежу, потрібно виконати receiver_verify';
        case 'sender_verify':
            return 'Потрібне введення даних відправника. Для завершення платежу, потрібно виконати sender_verify';
        case 'senderapp_verify':
            return 'Очікується підтвердження в додатку Privat24';
        case 'wait_qr':
            return 'Очікується сканування QR-коду клієнтом';
        case 'p24_verify':
            return 'Очікується завершення платежу в Приват24';
        case 'mp_verify':
            return 'Очікується завершення платежу в гаманці MasterPass';
        case 'cash_wait':
            return 'Очікується оплата готівкою в ТСО';
        case 'hold_wait':
            return 'Сума успішно заблокована на рахунку відправника';
        case 'invoice_wait':
            return 'Інвойс створений успішно, очікується оплата';
        case 'prepared':
            return 'Платіж створений, очікується його завершення відправником';
        case 'processing':
            return 'Платіж обробляється';
        case 'wait_accept':
            return 'Кошти з клієнта списані, але магазин ще не пройшов перевірку. Якщо магазин не пройде активацію протягом 60 днів, платежі будуть автоматично скасовані';
        case 'wait_card':
            return 'Не встановлений спосіб відшкодування у одержувача';
        case 'wait_compensation':
            return 'Платіж успішний, буде зарахований в щодобовій проводці';
        case 'wait_lc':
            return 'Акредитив. Кошти з клієнта списані, очікується підтвердження доставки товару';
        case 'wait_reserve':
            return 'Грошові кошти за платежем зарезервовані для проведення повернення за раніше поданою заявкою';
        case 'wait_secure':
            return 'Платіж на перевірці';
        case 'try_again':
            return 'Оплата неуспішна. Клієнт може повторити спробу ще раз';
        default:
            return 'Невідомий статус'
    }
}