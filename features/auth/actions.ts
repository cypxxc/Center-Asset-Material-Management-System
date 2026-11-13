'use server'

import {
  postgresAddPersonalEmail,
  postgresLogin,
  postgresSignOut,
  postgresUpdatePassword,
  postgresUpdateSidebar,
} from './postgres-actions'

export type PasswordActionState = {
  error?: string
  success?: string
}

export async function addPersonalEmail(_prevState: PasswordActionState | null, formData: FormData): Promise<PasswordActionState> {
  return postgresAddPersonalEmail(formData)
}

export async function signOut() {
  return postgresSignOut()
}

export async function login(_prevState: { error?: string } | null, formData: FormData) {
  return postgresLogin(formData)
}

export async function updatePersonalPassword(_prevState: PasswordActionState | null, formData: FormData): Promise<PasswordActionState> {
  return postgresUpdatePassword(formData)
}

export async function updateSidebarOrder(order: string[]): Promise<{ success?: boolean; error?: string }> {
  return postgresUpdateSidebar(order)
}
