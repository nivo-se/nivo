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
        console.warn('No authenticated user found, using localStorage fallback')
        return await this.getSavedListsFallback()
      }

      console.log('Fetching saved lists for user:', user.id)

      const { data, error } = await supabase
        .from('saved_company_lists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching saved lists from database:', error)
        console.log('Falling back to localStorage')
        return await this.getSavedListsFallback()
      }

      console.log('Found', data?.length || 0, 'saved lists in database')

      if (!data || data.length === 0) {
        console.log('No lists in database, trying localStorage fallback')
        const fallbackLists = await this.getSavedListsFallback()
        
        // If we have lists in localStorage but not in database, offer to migrate them
        if (fallbackLists.length > 0) {
          console.log(`Found ${fallbackLists.length} lists in localStorage, consider migrating to database`)
        }
        
        return fallbackLists
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
      console.log('Falling back to localStorage')
      return await this.getSavedListsFallback()
    }
  }

  /**
   * Save a new list or update an existing one
   */
  static async saveList(list: Omit<SavedCompanyList, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavedCompanyList | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.warn('No authenticated user found, using localStorage fallback')
        const newList: SavedCompanyList = {
          ...list,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        await this.saveListFallback(newList)
        return newList
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
        console.warn('No authenticated user found, using localStorage fallback')
        const existingLists = await this.getSavedListsFallback()
        const existingList = existingLists.find(l => l.id === id)
        if (!existingList) {
          console.error('List not found for update')
          return null
        }
        const updatedList = {
          ...existingList,
          ...updates,
          updatedAt: new Date().toISOString()
        }
        await this.saveListFallback(updatedList)
        return updatedList
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
   * Add companies to an existing list (merge with existing companies)
   */
  static async addCompaniesToList(listId: string, newCompanies: any[]): Promise<SavedCompanyList | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.warn('No authenticated user found, using localStorage fallback')
        const existingLists = await this.getSavedListsFallback()
        const existingList = existingLists.find(l => l.id === listId)
        if (!existingList) {
          console.error('List not found for adding companies')
          return null
        }
        
        // Merge companies (avoid duplicates)
        const existingOrgNrs = new Set(existingList.companies.map(c => c.OrgNr))
        const uniqueNewCompanies = newCompanies.filter(c => !existingOrgNrs.has(c.OrgNr))
        const updatedList = {
          ...existingList,
          companies: [...existingList.companies, ...uniqueNewCompanies],
          updatedAt: new Date().toISOString()
        }
        await this.saveListFallback(updatedList)
        return updatedList
      }

      // First get the current list
      const { data: currentList, error: fetchError } = await supabase
        .from('saved_company_lists')
        .select('*')
        .eq('id', listId)
        .eq('user_id', user.id)
        .single()

      if (fetchError || !currentList) {
        console.error('Error fetching current list:', fetchError)
        return null
      }

      // Merge companies (avoid duplicates based on OrgNr)
      const existingCompanies = currentList.companies || []
      const existingOrgNrs = new Set(existingCompanies.map((c: any) => c.OrgNr))
      
      const uniqueNewCompanies = newCompanies.filter(company => 
        !existingOrgNrs.has(company.OrgNr)
      )

      const mergedCompanies = [...existingCompanies, ...uniqueNewCompanies]

      // Update the list with merged companies
      const { data, error } = await supabase
        .from('saved_company_lists')
        .update({
          companies: mergedCompanies,
          updated_at: new Date().toISOString()
        })
        .eq('id', listId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Error adding companies to list:', error)
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
      console.error('Error in addCompaniesToList:', error)
      return null
    }
  }

  /**
   * Remove companies from an existing list
   */
  static async removeCompaniesFromList(listId: string, companyOrgNrs: string[]): Promise<SavedCompanyList | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.warn('No authenticated user found, using localStorage fallback')
        const existingLists = await this.getSavedListsFallback()
        const existingList = existingLists.find(l => l.id === listId)
        if (!existingList) {
          console.error('List not found for removing companies')
          return null
        }
        
        // Remove companies
        const updatedList = {
          ...existingList,
          companies: existingList.companies.filter(c => !companyOrgNrs.includes(c.OrgNr)),
          updatedAt: new Date().toISOString()
        }
        await this.saveListFallback(updatedList)
        return updatedList
      }

      // First get the current list
      const { data: currentList, error: fetchError } = await supabase
        .from('saved_company_lists')
        .select('*')
        .eq('id', listId)
        .eq('user_id', user.id)
        .single()

      if (fetchError || !currentList) {
        console.error('Error fetching current list:', fetchError)
        return null
      }

      // Remove companies with matching OrgNrs
      const existingCompanies = currentList.companies || []
      const filteredCompanies = existingCompanies.filter((company: any) => 
        !companyOrgNrs.includes(company.OrgNr)
      )

      // Update the list with filtered companies
      const { data, error } = await supabase
        .from('saved_company_lists')
        .update({
          companies: filteredCompanies,
          updated_at: new Date().toISOString()
        })
        .eq('id', listId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Error removing companies from list:', error)
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
      console.error('Error in removeCompaniesFromList:', error)
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
        console.warn('No authenticated user found, using localStorage fallback')
        await this.deleteListFallback(id)
        return true
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
      
      // Return empty array - no mock data, use real database data only
      const mockLists: SavedCompanyList[] = []
      
      // Store mock data in localStorage for future use
      localStorage.setItem('savedCompanyLists', JSON.stringify(mockLists))
      return mockLists
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
