import { Auth, FetchedAccounts, Preferences } from './models'
import { fetchConfirmRegister, fetchDeviceRegister, fetchGetBalance, fetchGetCards, fetchHistory, fetchLogin, getAuthToken } from './fetchApi'
import { generateRandomString } from '../../common/utils'
import { InvalidOtpCodeError, InvalidPreferencesError } from '../../errors'
import { getNumber } from '../../types/get'

function getPhoneNumber (rawPhoneNumber: string): string | null {
  const normalizedPhoneNumber = /^(?:\+?998)(\d{9})$/.exec(rawPhoneNumber.trim())

  if (normalizedPhoneNumber) {
    return '998' + normalizedPhoneNumber[1]
  }

  return null
}

function validatePreferences (rawPreferences: Preferences): Preferences {
  const phone = getPhoneNumber(rawPreferences.phone)
  if (phone === null) {
    throw new InvalidPreferencesError('Неверный формат номера телефона')
  }
  if (!rawPreferences.password.match(/^\d{5}$/)) {
    throw new InvalidPreferencesError('CLICK-PIN должен состоять из 5 цифр')
  }

  return { phone, password: rawPreferences.password }
}

async function askSmsCode (): Promise<string> {
  const sms = await ZenMoney.readLine('Введите код из СМС сообщения', { inputType: 'number' })
  if (!sms) {
    throw new InvalidOtpCodeError()
  }
  return sms
}

export async function login (rawPreferences: Preferences, auth?: Auth): Promise<Auth> {
  const { phone, password } = validatePreferences(rawPreferences)
  if (!auth) {
    const imei = generateRandomString(16, '0123456789abcdef')
    const deviceId = await fetchDeviceRegister(phone, imei)
    const smsCode = await askSmsCode()
    await fetchConfirmRegister(phone, smsCode, { deviceId })
    const authToken = getAuthToken(phone, deviceId, smsCode)
    const sessionKey = await fetchLogin(phone, password, { deviceId, authToken })
    return { imei, deviceId, authToken, sessionKey }
  }

  auth.sessionKey = await fetchLogin(phone, password, auth)
  return auth
}

export async function fetchAccounts (auth: Auth): Promise<FetchedAccounts> {
  const cards = await fetchGetCards(auth)
  const balances = await fetchGetBalance(cards.map(x => getNumber(x, 'id')), auth)
  return { cards, balances }
}

export async function fetchTransactions (productId: string, fromDate: Date, toDate: Date, auth: Auth): Promise<unknown[]> {
  return await fetchHistory(productId, fromDate, toDate, auth)
}
