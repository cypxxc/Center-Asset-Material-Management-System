'use server'

import { mutatePostgresMetadata, updatePostgresSettingsProfile } from './postgres-actions'

export async function createCategory(formData: FormData) { return mutatePostgresMetadata('categories', 'create', formData) }
export async function updateCategory(id: string, formData: FormData) { return mutatePostgresMetadata('categories', 'update', formData, id) }
export async function deleteCategory(id: string) { return mutatePostgresMetadata('categories', 'delete', undefined, id) }
export async function createLocation(formData: FormData) { return mutatePostgresMetadata('locations', 'create', formData) }
export async function updateLocation(id: string, formData: FormData) { return mutatePostgresMetadata('locations', 'update', formData, id) }
export async function deleteLocation(id: string) { return mutatePostgresMetadata('locations', 'delete', undefined, id) }
export async function createUnit(formData: FormData) { return mutatePostgresMetadata('units', 'create', formData) }
export async function updateUnit(id: string, formData: FormData) { return mutatePostgresMetadata('units', 'update', formData, id) }
export async function deleteUnit(id: string) { return mutatePostgresMetadata('units', 'delete', undefined, id) }
export async function updateProfile(id: string, formData: FormData) { return updatePostgresSettingsProfile(id, formData) }
