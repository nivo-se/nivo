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
        console.warn('No authenticated user found, trying localStorage fallback')
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
      
      // Create mock data with real companies for testing
      const mockLists: SavedCompanyList[] = [
        {
          id: 'test-list-1',
          name: 'Real Companies List',
          description: 'Real companies from database for testing',
          companies: [
            {
              OrgNr: '5591747166',
              name: 'Tullkurvan AB',
              address: 'Norra Esplanaden 2',
              city: 'Haparanda',
              incorporation_date: '2018-10-09',
              email: null,
              homepage: null,
              segment: '10001335',
              segment_name: 'Bilreservdelar',
              revenue: '23128',
              profit: '1107',
              employees: '6',
              Revenue_growth: 0.144157514593846,
              EBIT_margin: 0.0478640608785887,
              last_updated: new Date().toISOString()
            } as SupabaseCompany,
            {
              OrgNr: '5593152019',
              name: 'Wildlife Studios Sweden AB',
              address: 'Stockholmsvägen 33',
              city: 'Lidingö',
              incorporation_date: '2021-04-29',
              email: null,
              homepage: null,
              segment: '10001979',
              segment_name: 'Data- och TV-spel',
              revenue: '40148',
              profit: '2297',
              employees: '17',
              Revenue_growth: 0.404611132491341,
              EBIT_margin: 0.0572133107502242,
              last_updated: new Date().toISOString()
            } as SupabaseCompany,
            {
              OrgNr: '5566950209',
              name: 'Femlycke AB',
              address: 'Bråtelycke',
              city: 'Fågelmara',
              incorporation_date: '2005-12-23',
              email: null,
              homepage: null,
              segment: '10241590',
              segment_name: 'Gasproduktion',
              revenue: '31617',
              profit: '621',
              employees: '9',
              Revenue_growth: 0.0713995255845477,
              EBIT_margin: 0.0196413321947054,
              last_updated: new Date().toISOString()
            } as SupabaseCompany
          ],
          filters: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
      
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
