import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Checkbox } from './ui/checkbox'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  Plus, 
  Save, 
  Users, 
  Building2, 
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { SavedCompanyList, SavedListsService } from '../lib/savedListsService'
import { SupabaseCompany } from '../lib/supabaseDataService'
import { toast } from './ui/use-toast'

interface AddToListsDialogProps {
  isOpen: boolean
  onClose: () => void
  companies: SupabaseCompany[]
  onSuccess?: (list: SavedCompanyList) => void
}

const AddToListsDialog: React.FC<AddToListsDialogProps> = ({
  isOpen,
  onClose,
  companies,
  onSuccess
}) => {
  const [savedLists, setSavedLists] = useState<SavedCompanyList[]>([])
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [loading, setLoading] = useState(false)
  
  // New list form
  const [newListName, setNewListName] = useState('')
  const [newListDescription, setNewListDescription] = useState('')

  // Load saved lists when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadSavedLists()
    }
  }, [isOpen])

  const loadSavedLists = async () => {
    try {
      const lists = await SavedListsService.getSavedLists()
      setSavedLists(lists)
    } catch (error) {
      console.error('Error loading saved lists:', error)
      toast({
        title: 'Fel vid laddning av listor',
        description: 'Kunde inte ladda sparade listor.',
        variant: 'destructive',
      })
    }
  }

  const handleListToggle = (listId: string) => {
    const newSelected = new Set(selectedLists)
    if (newSelected.has(listId)) {
      newSelected.delete(listId)
    } else {
      newSelected.add(listId)
    }
    setSelectedLists(newSelected)
  }

  const handleAddToExistingLists = async () => {
    if (selectedLists.size === 0) {
      toast({
        title: 'Välj listor',
        description: 'Du måste välja minst en lista att lägga till företagen i.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const promises = Array.from(selectedLists).map(async (listId) => {
        const list = savedLists.find(l => l.id === listId)
        if (list) {
          return await SavedListsService.addCompaniesToList(listId, companies)
        }
        return null
      })

      const results = await Promise.all(promises)
      const successful = results.filter(result => result !== null)

      if (successful.length > 0) {
        toast({
          title: 'Företag tillagda',
          description: `${companies.length} företag har lagts till i ${successful.length} lista(r).`,
        })
        
        // Call success callback with the first successful list
        onSuccess?.(successful[0]!)
        onClose()
      }
    } catch (error) {
      console.error('Error adding companies to lists:', error)
      toast({
        title: 'Fel vid tillägg',
        description: 'Kunde inte lägga till företagen i listorna.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNewList = async () => {
    if (!newListName.trim()) {
      toast({
        title: 'Listnamn saknas',
        description: 'Vänligen ange ett namn för den nya listan.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const newList = await SavedListsService.saveList({
        name: newListName.trim(),
        description: newListDescription.trim(),
        companies: companies,
        filters: {}
      })

      if (newList) {
        toast({
          title: 'Ny lista skapad',
          description: `Listan "${newList.name}" har skapats med ${companies.length} företag.`,
        })
        
        onSuccess?.(newList)
        onClose()
      }
    } catch (error) {
      console.error('Error creating new list:', error)
      toast({
        title: 'Fel vid skapande',
        description: 'Kunde inte skapa den nya listan.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const getCompanySummary = () => {
    const industries = new Set(companies.map(c => c.segment_name).filter(Boolean))
    const totalRevenue = companies.reduce((sum, c) => sum + (c.SDI || 0), 0)
    const totalEmployees = companies.reduce((sum, c) => sum + (c.employees || 0), 0)

    return {
      count: companies.length,
      industries: Array.from(industries),
      totalRevenue,
      totalEmployees
    }
  }

  const summary = getCompanySummary()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lägg till företag i listor
          </DialogTitle>
        </DialogHeader>

        {/* Company Summary */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Valda företag ({summary.count})</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Branscher:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {summary.industries.map(industry => (
                  <Badge key={industry} variant="outline" className="text-xs">
                    {industry}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Total omsättning:</span>
              <div className="font-medium">
                {summary.totalRevenue.toLocaleString('sv-SE')} SEK
              </div>
            </div>
            <div>
              <span className="text-gray-600">Total anställda:</span>
              <div className="font-medium">
                {summary.totalEmployees.toLocaleString('sv-SE')}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs for existing vs new list */}
        <Tabs value={mode} onValueChange={(value: 'existing' | 'new') => setMode(value)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Befintliga listor</TabsTrigger>
            <TabsTrigger value="new">Ny lista</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-4">
            {savedLists.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Inga sparade listor än.</p>
                <p className="text-sm">Skapa din första lista för att komma igång.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {savedLists.map((list) => (
                  <div
                    key={list.id}
                    className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <Checkbox
                      id={list.id}
                      checked={selectedLists.has(list.id)}
                      onCheckedChange={() => handleListToggle(list.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={list.id} className="font-medium cursor-pointer">
                          {list.name}
                        </Label>
                        <Badge variant="outline" className="text-xs">
                          {list.companies.length} företag
                        </Badge>
                      </div>
                      {list.description && (
                        <p className="text-sm text-gray-600 mt-1">{list.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="new" className="space-y-4">
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
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Avbryt
          </Button>
          {mode === 'existing' ? (
            <Button 
              onClick={handleAddToExistingLists} 
              disabled={loading || selectedLists.size === 0}
            >
              {loading ? (
                'Lägger till...'
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Lägg till i {selectedLists.size} lista(r)
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={handleCreateNewList} 
              disabled={loading || !newListName.trim()}
            >
              {loading ? (
                'Skapar...'
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Skapa lista
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AddToListsDialog
