import { supabase } from './supabase'
import { SupabaseCompany } from './supabaseDataService'

export interface SavedCompanyList {
  id: string
  name: string
  description?: string
  companies: SupabaseCompany[]
  filters: any
  createdAt: string
  updatedAt: string
}

export class SavedListsService {
  /**
   * Get all saved lists for the current user
   */
  static async getSavedLists(): Promise<SavedCompanyList[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.warn('No authenticated user found')
        return []
      }

      const { data, error } = await supabase
        .from('saved_company_lists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching saved lists:', error)
        return []
      }

      return data.map(list => ({
        id: list.id,
        name: list.name,
        description: list.description,
        companies: list.companies || [],
        filters: list.filters || {},
        createdAt: list.created_at,
        updatedAt: list.updated_at
      }))
    } catch (error) {
      console.error('Error in getSavedLists:', error)
      return []
    }
  }

  /**
   * Save a new list or update an existing one
   */
  static async saveList(list: Omit<SavedCompanyList, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavedCompanyList | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No authenticated user found')
        return null
      }

      const listData = {
        user_id: user.id,
        name: list.name,
        description: list.description,
        companies: list.companies,
        filters: list.filters
      }

      const { data, error } = await supabase
        .from('saved_company_lists')
        .insert(listData)
        .select()
        .single()

      if (error) {
        console.error('Error saving list:', error)
        return null
      }

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        companies: data.companies || [],
        filters: data.filters || {},
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    } catch (error) {
      console.error('Error in saveList:', error)
      return null
    }
  }

  /**
   * Update an existing list
   */
  static async updateList(id: string, updates: Partial<Omit<SavedCompanyList, 'id' | 'createdAt' | 'updatedAt'>>): Promise<SavedCompanyList | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No authenticated user found')
        return null
      }

      const updateData: any = {}
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.description !== undefined) updateData.description = updates.description
      if (updates.companies !== undefined) updateData.companies = updates.companies
      if (updates.filters !== undefined) updateData.filters = updates.filters

      const { data, error } = await supabase
        .from('saved_company_lists')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating list:', error)
        return null
      }

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        companies: data.companies || [],
        filters: data.filters || {},
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    } catch (error) {
      console.error('Error in updateList:', error)
      return null
    }
  }

  /**
   * Delete a list
   */
  static async deleteList(id: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No authenticated user found')
        return false
      }

      const { error } = await supabase
        .from('saved_company_lists')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error deleting list:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in deleteList:', error)
      return false
    }
  }

  /**
   * Fallback to localStorage if database is not available
   */
  static async getSavedListsFallback(): Promise<SavedCompanyList[]> {
    try {
      const saved = localStorage.getItem('savedCompanyLists')
      if (saved) {
        return JSON.parse(saved)
      }
      return []
    } catch (error) {
      console.error('Error loading from localStorage:', error)
      return []
    }
  }

  /**
   * Save to localStorage as fallback
   */
  static async saveListFallback(list: SavedCompanyList): Promise<void> {
    try {
      const existing = await this.getSavedListsFallback()
      const updated = existing.filter(l => l.id !== list.id)
      updated.push(list)
      localStorage.setItem('savedCompanyLists', JSON.stringify(updated))
    } catch (error) {
      console.error('Error saving to localStorage:', error)
    }
  }

  /**
   * Delete from localStorage as fallback
   */
  static async deleteListFallback(id: string): Promise<void> {
    try {
      const existing = await this.getSavedListsFallback()
      const updated = existing.filter(l => l.id !== id)
      localStorage.setItem('savedCompanyLists', JSON.stringify(updated))
    } catch (error) {
      console.error('Error deleting from localStorage:', error)
    }
  }
}
