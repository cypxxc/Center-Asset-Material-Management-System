'use server'

import {
  postgresLogin,
  postgresSignOut,
  postgresUpdatePassword,
  postgresUpdateProfile,
  postgresUpdateSidebar,
} from './postgres-actions'

export type PersonalProfileActionState = {
  error?: string
  success?: string
}

export async function signOut() {
  return postgresSignOut()
}

export async function login(_prevState: { error?: string } | null, formData: FormData) {
  return postgresLogin(formData)
}

export async function updatePersonalProfile(_prevState: PersonalProfileActionState | null, formData: FormData): Promise<PersonalProfileActionState> {
  return postgresUpdateProfile(formData)
}

export async function updatePersonalPassword(_prevState: PersonalProfileActionState | null, formData: FormData): Promise<PersonalProfileActionState> {
  return postgresUpdatePassword(formData)
}

export async function updateSidebarOrder(order: string[]): Promise<{ success?: boolean; error?: string }> {
  return postgresUpdateSidebar(order)
}
