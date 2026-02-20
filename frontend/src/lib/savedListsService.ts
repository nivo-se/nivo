import { getAccessToken } from './authToken'
import { SupabaseCompany } from './supabaseDataService'

async function authHeaders(extra: HeadersInit = {}): Promise<HeadersInit> {
  const token = await getAccessToken()
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

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
      console.log('Fetching saved lists from API...')
      const headers = await authHeaders()
      const response = await fetch('/api/saved-lists', { headers })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch saved lists')
      }

      // Only log if we actually have lists
      if (result.data && result.data.length > 0) {
        console.log('Found', result.data.length, 'saved lists from API')
      }

      if (!result.data || result.data.length === 0) {
        // Silently fall back to localStorage - no need to log this
        const fallbackLists = await this.getSavedListsFallback()

        // If we have lists in localStorage but not in database, offer to migrate them
        if (fallbackLists.length > 0) {
          console.log(`Found ${fallbackLists.length} lists in localStorage, consider migrating to database`)
        }

        return fallbackLists
      }

      return result.data.map((list: any) => ({
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
      console.log('Saving list via API:', list.name)
      const headers = await authHeaders({ 'Content-Type': 'application/json' })
      const response = await fetch('/api/saved-lists', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: list.name,
          description: list.description,
          companies: list.companies,
          filters: list.filters
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to save list')
      }

      console.log('List saved successfully:', result.data.id)

      return {
        id: result.data.id,
        name: result.data.name,
        description: result.data.description,
        companies: result.data.companies || [],
        filters: result.data.filters || {},
        createdAt: result.data.created_at,
        updatedAt: result.data.updated_at
      }
    } catch (error) {
      console.error('Error in saveList:', error)
      console.log('Falling back to localStorage')

      // Fallback to localStorage
      const newList: SavedCompanyList = {
        ...list,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      await this.saveListFallback(newList)
      return newList
    }
  }

  /**
   * Update an existing list
   */
  static async updateList(id: string, updates: Partial<Omit<SavedCompanyList, 'id' | 'createdAt' | 'updatedAt'>>): Promise<SavedCompanyList | null> {
    try {
      console.log('Updating list via API:', id)
      const headers = await authHeaders({ 'Content-Type': 'application/json' })
      const response = await fetch(`/api/saved-lists/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to update list')
      }

      console.log('List updated successfully:', result.data.id)

      return {
        id: result.data.id,
        name: result.data.name,
        description: result.data.description,
        companies: result.data.companies || [],
        filters: result.data.filters || {},
        createdAt: result.data.created_at,
        updatedAt: result.data.updated_at
      }
    } catch (error) {
      console.error('Error in updateList:', error)
      console.log('Falling back to localStorage')

      // Fallback to localStorage
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
  }

  /**
   * Add companies to an existing list (merge with existing companies)
   */
  static async addCompaniesToList(listId: string, newCompanies: any[]): Promise<SavedCompanyList | null> {
    try {
      const token = await getAccessToken()
      if (!token) {
        console.warn('No auth token, using localStorage fallback')
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

      const lists = await this.getSavedLists()
      const currentList = lists.find(l => l.id === listId)
      if (!currentList) {
        console.error('List not found for adding companies')
        return null
      }
      const existingOrgNrs = new Set((currentList.companies || []).map((c: any) => c.OrgNr))
      const uniqueNewCompanies = newCompanies.filter(company => !existingOrgNrs.has(company.OrgNr))
      const mergedCompanies = [...(currentList.companies || []), ...uniqueNewCompanies]
      return this.updateList(listId, { companies: mergedCompanies })
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
      const token = await getAccessToken()
      if (!token) {
        console.warn('No auth token, using localStorage fallback')
        const existingLists = await this.getSavedListsFallback()
        const existingList = existingLists.find(l => l.id === listId)
        if (!existingList) {
          console.error('List not found for removing companies')
          return null
        }
        const updatedList = {
          ...existingList,
          companies: existingList.companies.filter(c => !companyOrgNrs.includes(c.OrgNr)),
          updatedAt: new Date().toISOString()
        }
        await this.saveListFallback(updatedList)
        return updatedList
      }
      const lists = await this.getSavedLists()
      const currentList = lists.find(l => l.id === listId)
      if (!currentList) {
        console.error('List not found for removing companies')
        return null
      }
      const filteredCompanies = (currentList.companies || []).filter(
        (company: any) => !companyOrgNrs.includes(company.OrgNr)
      )
      return this.updateList(listId, { companies: filteredCompanies })
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
      console.log('Deleting list via API:', id)
      const headers = await authHeaders()
      const response = await fetch(`/api/saved-lists/${id}`, {
        method: 'DELETE',
        headers
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete list')
      }

      console.log('List deleted successfully:', id)
      return true
    } catch (error) {
      console.error('Error in deleteList:', error)
      console.log('Falling back to localStorage')

      // Fallback to localStorage
      await this.deleteListFallback(id)
      return true
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
