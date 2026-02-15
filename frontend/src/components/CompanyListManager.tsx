import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { 
  Save, 
  List, 
  Plus, 
  Trash2, 
  Edit, 
  Building2,
  Calendar,
  Users,
  X,
  Eye,
  EyeOff
} from 'lucide-react'
import { SupabaseCompany } from '../lib/supabaseDataService'
import { SavedListsService, SavedCompanyList } from '../lib/savedListsService'

// SavedCompanyList interface is now imported from savedListsService

interface CompanyListManagerProps {
  currentCompanies: SupabaseCompany[]
  currentFilters: any
  onListSelect: (list: SavedCompanyList) => void
  onListUpdate: (lists: SavedCompanyList[]) => void
}

const CompanyListManager: React.FC<CompanyListManagerProps> = ({
  currentCompanies,
  currentFilters,
  onListSelect,
  onListUpdate
}) => {
  const [savedLists, setSavedLists] = useState<SavedCompanyList[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [listName, setListName] = useState('')
  const [listDescription, setListDescription] = useState('')
  const [editingList, setEditingList] = useState<SavedCompanyList | null>(null)
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set())
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())

  // Load saved lists from database on component mount
  useEffect(() => {
    const loadLists = async () => {
      console.log('CompanyListManager: Loading saved lists...')
      try {
        const lists = await SavedListsService.getSavedLists()
        console.log('CompanyListManager: Loaded', lists.length, 'saved lists from database')
        setSavedLists(lists)
        onListUpdate(lists)
      } catch (error) {
        console.error('CompanyListManager: Error loading saved lists:', error)
        // Fallback to localStorage
        const fallbackLists = await SavedListsService.getSavedListsFallback()
        console.log('CompanyListManager: Loaded', fallbackLists.length, 'saved lists from localStorage')
        setSavedLists(fallbackLists)
        onListUpdate(fallbackLists)
      }
    }
    loadLists()
  }, []) // Remove onListUpdate from dependency array to prevent infinite loop

  // No need to save to localStorage automatically - database handles persistence

  const saveCurrentList = async () => {
    if (!listName.trim()) return

    try {
      const listData = {
        name: listName.trim(),
        description: listDescription.trim() || undefined,
        companies: [...currentCompanies],
        filters: { ...currentFilters }
      }

      let savedList: SavedCompanyList | null = null

      if (editingList) {
        // Update existing list
        savedList = await SavedListsService.updateList(editingList.id, listData)
      } else {
        // Add new list
        savedList = await SavedListsService.saveList(listData)
      }

      if (savedList) {
        // Refresh the lists
        const updatedLists = await SavedListsService.getSavedLists()
        setSavedLists(updatedLists)
        onListUpdate(updatedLists)
        
        setIsDialogOpen(false)
        setListName('')
        setListDescription('')
        setEditingList(null)
        setSelectedCompanies(new Set())
      } else {
        console.error('Failed to save list')
        // Fallback to localStorage
        const fallbackList: SavedCompanyList = {
          id: editingList?.id || Date.now().toString(),
          name: listName.trim(),
          description: listDescription.trim() || undefined,
          companies: [...currentCompanies],
          filters: { ...currentFilters },
          createdAt: editingList?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        await SavedListsService.saveListFallback(fallbackList)
        
        if (editingList) {
          setSavedLists(prev => prev.map(list => 
            list.id === editingList.id ? fallbackList : list
          ))
        } else {
          setSavedLists(prev => [...prev, fallbackList])
        }
        onListUpdate(savedLists)
        
        setIsDialogOpen(false)
        setListName('')
        setListDescription('')
        setEditingList(null)
        setSelectedCompanies(new Set())
      }
    } catch (error) {
      console.error('Error saving list:', error)
    }
  }

  const deleteList = async (listId: string) => {
    try {
      const success = await SavedListsService.deleteList(listId)
      if (success) {
        // Refresh the lists
        const updatedLists = await SavedListsService.getSavedLists()
        setSavedLists(updatedLists)
        onListUpdate(updatedLists)
      } else {
        console.error('Failed to delete list')
        // Fallback to localStorage
        await SavedListsService.deleteListFallback(listId)
        setSavedLists(prev => prev.filter(list => list.id !== listId))
        onListUpdate(savedLists.filter(list => list.id !== listId))
      }
    } catch (error) {
      console.error('Error deleting list:', error)
    }
  }

  const editList = (list: SavedCompanyList) => {
    setEditingList(list)
    setListName(list.name)
    setListDescription(list.description || '')
    setSelectedCompanies(new Set()) // Reset selected companies
    setIsDialogOpen(true)
  }

  const toggleCompanySelection = (orgNr: string) => {
    setSelectedCompanies(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orgNr)) {
        newSet.delete(orgNr)
      } else {
        newSet.add(orgNr)
      }
      return newSet
    })
  }

  const removeSelectedCompanies = async () => {
    if (!editingList || selectedCompanies.size === 0) return

    try {
      const updatedCompanies = editingList.companies.filter(
        company => !selectedCompanies.has(company.OrgNr)
      )
      
      const success = await SavedListsService.updateList(editingList.id, {
        companies: updatedCompanies
      })

      if (success) {
        const updatedLists = await SavedListsService.getSavedLists()
        setSavedLists(updatedLists)
        onListUpdate(updatedLists)
        setSelectedCompanies(new Set())
        
        // Update the editing list with new companies
        setEditingList({
          ...editingList,
          companies: updatedCompanies
        })
      } else {
        console.error('Failed to remove companies from list')
      }
    } catch (error) {
      console.error('Error removing companies from list:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  console.log('CompanyListManager: Rendering with', currentCompanies.length, 'companies and', savedLists.length, 'saved lists')

  return (
    <div className="space-y-4">
      {/* Save Current List Button */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full"
            disabled={currentCompanies.length === 0}
          >
            <Save className="h-4 w-4 mr-2" />
            Spara valda företag ({currentCompanies.length} företag)
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingList ? 'Redigera lista' : 'Spara företagslista'}
            </DialogTitle>
            <DialogDescription>
              {editingList 
                ? 'Uppdatera informationen för denna lista.'
                : 'Spara den aktuella sökningen och filtren som en lista för framtida användning.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Listnamn *</label>
              <Input
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="t.ex. 'Högväxande tech-företag'"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Beskrivning</label>
              <Input
                value={listDescription}
                onChange={(e) => setListDescription(e.target.value)}
                placeholder="Kort beskrivning av listan..."
                className="mt-1"
              />
            </div>
            <div className="text-sm text-gray-600">
              <p><strong>Företag:</strong> {editingList ? editingList.companies.length : currentCompanies.length}</p>
              <p><strong>Filter:</strong> {Object.keys(currentFilters).length > 0 ? 'Aktiva' : 'Inga'}</p>
            </div>

            {/* Company Management Section - Only show when editing existing list */}
            {editingList && editingList.companies.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Hantera företag i listan</h4>
                  {selectedCompanies.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={removeSelectedCompanies}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Ta bort valda ({selectedCompanies.size})
                    </Button>
                  )}
                </div>
                
                <div className="max-h-60 overflow-y-auto border rounded-lg p-3 space-y-2">
                  {editingList.companies.map((company) => (
                    <div
                      key={company.OrgNr}
                      className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors ${
                        selectedCompanies.has(company.OrgNr)
                          ? 'bg-red-50 border-red-200'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => toggleCompanySelection(company.OrgNr)}
                    >
                      <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                        selectedCompanies.has(company.OrgNr)
                          ? 'bg-red-500 border-red-500'
                          : 'border-gray-300'
                      }`}>
                        {selectedCompanies.has(company.OrgNr) && (
                          <X className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{company.name}</div>
                        <div className="text-xs text-gray-500">{company.OrgNr}</div>
                        {company.segment_name && (
                          <div className="text-xs text-gray-400">{company.segment_name}</div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {company.SDI ? `${(company.SDI / 1000).toFixed(0)} TSEK` : 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
                
                {editingList.companies.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Inga företag i denna lista
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsDialogOpen(false)
              setListName('')
              setListDescription('')
              setEditingList(null)
              setSelectedCompanies(new Set())
            }}>
              Avbryt
            </Button>
            <Button onClick={saveCurrentList} disabled={!listName.trim()}>
              {editingList ? 'Uppdatera' : 'Spara lista'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saved Lists */}
      {savedLists.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <List className="h-5 w-5 mr-2" />
              Sparade listor ({savedLists.length})
            </CardTitle>
            <CardDescription>
              Dina sparade företagslistor för snabb åtkomst
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {savedLists.map((list) => (
                <div 
                  key={list.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onListSelect(list)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{list.name}</h4>
                      <Badge variant="secondary">{list.companies.length} företag</Badge>
                    </div>
                    {list.description && (
                      <p className="text-sm text-gray-600 mb-2">{list.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Skapad: {formatDate(list.createdAt)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        Uppdaterad: {formatDate(list.updatedAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onListSelect(list)
                      }}
                    >
                      Välj
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => editList(list)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteList(list.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default CompanyListManager

