import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Users, 
  Building2, 
  Search,
  Filter,
  Download,
  Upload,
  MoreHorizontal,
  Eye,
  EyeOff
} from 'lucide-react'
import { SavedCompanyList, SavedListsService } from '../lib/savedListsService'
import { SupabaseCompany } from '../lib/supabaseDataService'
import { toast } from './ui/use-toast'

interface ListManagerProps {
  onListSelect?: (list: SavedCompanyList) => void
  onCompanySelect?: (company: SupabaseCompany) => void
  showActions?: boolean
  allowEditing?: boolean
  allowSelection?: boolean
}

const ListManager: React.FC<ListManagerProps> = ({
  onListSelect,
  onCompanySelect,
  showActions = true,
  allowEditing = true,
  allowSelection = true
}) => {
  const [lists, setLists] = useState<SavedCompanyList[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedList, setSelectedList] = useState<SavedCompanyList | null>(null)
  const [editingList, setEditingList] = useState<SavedCompanyList | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showAddCompaniesDialog, setShowAddCompaniesDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterIndustry, setFilterIndustry] = useState('')
  const [filterSize, setFilterSize] = useState('')

  // Form states
  const [newListName, setNewListName] = useState('')
  const [newListDescription, setNewListDescription] = useState('')
  const [editListName, setEditListName] = useState('')
  const [editListDescription, setEditListDescription] = useState('')

  // Load lists on mount
  useEffect(() => {
    loadLists()
  }, [])

  const loadLists = async () => {
    setLoading(true)
    try {
      const data = await SavedListsService.getSavedLists()
      setLists(data)
    } catch (error) {
      console.error('Error loading lists:', error)
      toast({
        title: 'Fel vid laddning av listor',
        description: 'Kunde inte ladda sparade listor.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast({
        title: 'Listnamn saknas',
        description: 'Vänligen ange ett namn för den nya listan.',
        variant: 'destructive',
      })
      return
    }

    try {
      const newList = await SavedListsService.saveList({
        name: newListName.trim(),
        description: newListDescription.trim(),
        companies: [],
        filters: {}
      })

      if (newList) {
        setLists(prev => [newList, ...prev])
        setNewListName('')
        setNewListDescription('')
        setShowCreateDialog(false)
        toast({
          title: 'Lista skapad',
          description: `Listan "${newList.name}" har skapats.`,
        })
      }
    } catch (error) {
      console.error('Error creating list:', error)
      toast({
        title: 'Fel vid skapande',
        description: 'Kunde inte skapa den nya listan.',
        variant: 'destructive',
      })
    }
  }

  const handleEditList = async () => {
    if (!editingList || !editListName.trim()) {
      return
    }

    try {
      const updatedList = await SavedListsService.updateList(editingList.id, {
        name: editListName.trim(),
        description: editListDescription.trim()
      })

      if (updatedList) {
        setLists(prev => prev.map(list => 
          list.id === editingList.id ? updatedList : list
        ))
        setEditingList(null)
        setShowEditDialog(false)
        toast({
          title: 'Lista uppdaterad',
          description: `Listan "${updatedList.name}" har uppdaterats.`,
        })
      }
    } catch (error) {
      console.error('Error updating list:', error)
      toast({
        title: 'Fel vid uppdatering',
        description: 'Kunde inte uppdatera listan.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteList = async (listId: string, listName: string) => {
    if (!window.confirm(`Är du säker på att du vill ta bort listan "${listName}"?`)) {
      return
    }

    try {
      const success = await SavedListsService.deleteList(listId)
      if (success) {
        setLists(prev => prev.filter(list => list.id !== listId))
        if (selectedList?.id === listId) {
          setSelectedList(null)
        }
        toast({
          title: 'Lista borttagen',
          description: `Listan "${listName}" har tagits bort.`,
        })
      }
    } catch (error) {
      console.error('Error deleting list:', error)
      toast({
        title: 'Fel vid borttagning',
        description: 'Kunde inte ta bort listan.',
        variant: 'destructive',
      })
    }
  }

  const handleRemoveCompany = async (listId: string, companyOrgNr: string) => {
    try {
      const updatedList = await SavedListsService.removeCompaniesFromList(listId, [companyOrgNr])
      if (updatedList) {
        setLists(prev => prev.map(list => 
          list.id === listId ? updatedList : list
        ))
        if (selectedList?.id === listId) {
          setSelectedList(updatedList)
        }
        toast({
          title: 'Företag borttaget',
          description: 'Företaget har tagits bort från listan.',
        })
      }
    } catch (error) {
      console.error('Error removing company:', error)
      toast({
        title: 'Fel vid borttagning',
        description: 'Kunde inte ta bort företaget från listan.',
        variant: 'destructive',
      })
    }
  }

  const startEdit = (list: SavedCompanyList) => {
    setEditingList(list)
    setEditListName(list.name)
    setEditListDescription(list.description)
    setShowEditDialog(true)
  }

  const filteredCompanies = selectedList?.companies.filter(company => {
    const matchesSearch = !searchQuery || 
      company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.OrgNr.includes(searchQuery)
    
    const matchesIndustry = !filterIndustry || 
      company.segment_name === filterIndustry
    
    const matchesSize = !filterSize || (() => {
      const revenue = company.SDI || 0
      if (filterSize === 'small') return revenue < 10000000
      if (filterSize === 'medium') return revenue >= 10000000 && revenue <= 50000000
      if (filterSize === 'large') return revenue > 50000000
      return true
    })()
    
    return matchesSearch && matchesIndustry && matchesSize
  }) || []

  const getUniqueIndustries = () => {
    const industries = new Set<string>()
    selectedList?.companies.forEach(company => {
      if (company.segment_name) {
        industries.add(company.segment_name)
      }
    })
    return Array.from(industries).sort()
  }

  const exportList = (list: SavedCompanyList) => {
    const csvContent = [
      ['OrgNr', 'Namn', 'Bransch', 'Stad', 'Anställda', 'Omsättning', 'Vinst'],
      ...list.companies.map(company => [
        company.OrgNr,
        company.name,
        company.segment_name || '',
        company.city || '',
        company.employees || 0,
        company.SDI || 0,
        company.DR || 0
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${list.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Lists Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Företagslistor
            </CardTitle>
            {allowEditing && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Ny lista
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Laddar listor...</div>
          ) : lists.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Inga listor skapade än. Skapa din första lista för att komma igång.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lists.map((list) => (
                <Card 
                  key={list.id}
                  className={`cursor-pointer transition-all ${
                    selectedList?.id === list.id ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setSelectedList(list)
                    onListSelect?.(list)
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-medium">{list.name}</h3>
                        {list.description && (
                          <p className="text-sm text-gray-600 mt-1">{list.description}</p>
                        )}
                      </div>
                      {allowEditing && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              startEdit(list)
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteList(list.id, list.name)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">
                        {list.companies.length} företag
                      </Badge>
                      {showActions && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            exportList(list)
                          }}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected List Details */}
      {selectedList && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {selectedList.name}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAddCompaniesDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Lägg till företag
                </Button>
                <Button
                  variant="outline"
                  onClick={() => exportList(selectedList)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportera
                </Button>
              </div>
            </div>
            {selectedList.description && (
              <p className="text-gray-600">{selectedList.description}</p>
            )}
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <Label htmlFor="search">Sök företag</Label>
                <Input
                  id="search"
                  placeholder="Sök på namn eller organisationsnummer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="industry-filter">Bransch</Label>
                <Select value={filterIndustry} onValueChange={setFilterIndustry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alla branscher" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Alla branscher</SelectItem>
                    {getUniqueIndustries().map(industry => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="size-filter">Storlek</Label>
                <Select value={filterSize} onValueChange={setFilterSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alla storlekar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Alla storlekar</SelectItem>
                    <SelectItem value="small">Små (< 10M SEK)</SelectItem>
                    <SelectItem value="medium">Medelstora (10-50M SEK)</SelectItem>
                    <SelectItem value="large">Stora (> 50M SEK)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Companies List */}
            <div className="space-y-2">
              {filteredCompanies.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {selectedList.companies.length === 0 
                    ? 'Inga företag i denna lista än.' 
                    : 'Inga företag matchar de valda filtren.'
                  }
                </div>
              ) : (
                filteredCompanies.map((company) => (
                  <div
                    key={company.OrgNr}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{company.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {company.OrgNr}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        {company.segment_name} • {company.city} • {company.employees} anställda
                      </div>
                      <div className="text-sm text-gray-500">
                        Omsättning: {(company.SDI || 0).toLocaleString('sv-SE')} SEK
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {allowSelection && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onCompanySelect?.(company)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Visa
                        </Button>
                      )}
                      {allowEditing && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveCompany(selectedList.id, company.OrgNr)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create List Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skapa ny lista</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-list-name">Listnamn</Label>
              <Input
                id="new-list-name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="T.ex. Potentiella förvärv Q3"
              />
            </div>
            <div>
              <Label htmlFor="new-list-description">Beskrivning (valfritt)</Label>
              <Textarea
                id="new-list-description"
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                placeholder="Kort beskrivning av listan"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Avbryt
            </Button>
            <Button onClick={handleCreateList}>
              <Save className="h-4 w-4 mr-2" />
              Skapa lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit List Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redigera lista</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-list-name">Listnamn</Label>
              <Input
                id="edit-list-name"
                value={editListName}
                onChange={(e) => setEditListName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-list-description">Beskrivning</Label>
              <Textarea
                id="edit-list-description"
                value={editListDescription}
                onChange={(e) => setEditListDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Avbryt
            </Button>
            <Button onClick={handleEditList}>
              <Save className="h-4 w-4 mr-2" />
              Spara ändringar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ListManager
