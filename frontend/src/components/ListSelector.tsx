import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Badge } from './ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Plus, List, Users, Calendar } from 'lucide-react'
import { SavedListsService, SavedCompanyList } from '../lib/savedListsService'

interface ListSelectorProps {
  isOpen: boolean
  onClose: () => void
  selectedCompanies: any[]
  onSave: (listId: string, listName: string, isNewList: boolean) => void
  onListUpdate: (lists: SavedCompanyList[]) => void
}

const ListSelector: React.FC<ListSelectorProps> = ({
  isOpen,
  onClose,
  selectedCompanies,
  onSave,
  onListUpdate
}) => {
  const [savedLists, setSavedLists] = useState<SavedCompanyList[]>([])
  const [selectedOption, setSelectedOption] = useState<'existing' | 'new'>('existing')
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [newListName, setNewListName] = useState('')
  const [newListDescription, setNewListDescription] = useState('')
  const [loading, setLoading] = useState(false)

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
    }
  }

  const handleSave = async () => {
    if (selectedOption === 'existing' && !selectedListId) {
      alert('Välj en befintlig lista')
      return
    }

    if (selectedOption === 'new' && !newListName.trim()) {
      alert('Ange ett namn för den nya listan')
      return
    }

    setLoading(true)

    try {
      if (selectedOption === 'existing') {
        // Add companies to existing list
        const selectedList = savedLists.find(list => list.id === selectedListId)
        if (selectedList) {
          const updatedList = await SavedListsService.addCompaniesToList(selectedListId, selectedCompanies)
          if (updatedList) {
            onSave(selectedListId, selectedList.name, false)
            // Refresh lists
            const updatedLists = await SavedListsService.getSavedLists()
            setSavedLists(updatedLists)
            onListUpdate(updatedLists)
          }
        }
      } else {
        // Create new list
        const newList = await SavedListsService.saveList({
          name: newListName.trim(),
          description: newListDescription.trim() || undefined,
          companies: selectedCompanies,
          filters: {}
        })

        if (newList) {
          onSave(newList.id, newList.name, true)
          // Refresh lists
          const updatedLists = await SavedListsService.getSavedLists()
          setSavedLists(updatedLists)
          onListUpdate(updatedLists)
        }
      }

      // Reset form
      setSelectedOption('existing')
      setSelectedListId('')
      setNewListName('')
      setNewListDescription('')
      onClose()
    } catch (error) {
      console.error('Error saving to list:', error)
      alert('Ett fel uppstod vid sparande. Försök igen.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedOption('existing')
    setSelectedListId('')
    setNewListName('')
    setNewListDescription('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            Spara {selectedCompanies.length} företag till lista
          </DialogTitle>
          <DialogDescription>
            Välj om du vill lägga till företagen i en befintlig lista eller skapa en ny lista.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Selected companies summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Valda företag</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {selectedCompanies.slice(0, 5).map((company, index) => (
                  <Badge key={index} variant="secondary">
                    {company.name}
                  </Badge>
                ))}
                {selectedCompanies.length > 5 && (
                  <Badge variant="outline">
                    +{selectedCompanies.length - 5} fler
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Save options */}
          <RadioGroup value={selectedOption} onValueChange={(value: 'existing' | 'new') => setSelectedOption(value)}>
            <div className="space-y-4">
              {/* Existing list option */}
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="existing" id="existing" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="existing" className="text-sm font-medium">
                    Lägg till i befintlig lista
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Välj en av dina sparade listor att lägga till företagen i.
                  </p>
                  
                  {selectedOption === 'existing' && (
                    <div className="mt-3 space-y-2">
                      {savedLists.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">
                          Inga sparade listor hittades. Skapa en ny lista istället.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {savedLists.map((list) => (
                            <div
                              key={list.id}
                              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                selectedListId === list.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              onClick={() => setSelectedListId(list.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium text-sm">{list.name}</h4>
                                  {list.description && (
                                    <p className="text-xs text-gray-600 mt-1">{list.description}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <Users className="h-3 w-3" />
                                  {list.companies.length}
                                  <Calendar className="h-3 w-3" />
                                  {new Date(list.updatedAt).toLocaleDateString('sv-SE')}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* New list option */}
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="new" id="new" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="new" className="text-sm font-medium">
                    Skapa ny lista
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Skapa en ny lista med de valda företagen.
                  </p>
                  
                  {selectedOption === 'new' && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <Label htmlFor="newListName" className="text-sm">
                          Listnamn *
                        </Label>
                        <Input
                          id="newListName"
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                          placeholder="t.ex. Förvärvsmål 2024"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="newListDescription" className="text-sm">
                          Beskrivning (valfritt)
                        </Label>
                        <Textarea
                          id="newListDescription"
                          value={newListDescription}
                          onChange={(e) => setNewListDescription(e.target.value)}
                          placeholder="Beskrivning av listan..."
                          className="mt-1"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </RadioGroup>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Avbryt
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Sparar...' : 'Spara till lista'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ListSelector
