import React, { createContext, useContext, useState, useCallback } from 'react';
import { Company, List, ProspectStatus, Filters, mockCompanies } from './mockData';
import { 
  PromptTemplate, 
  AIRun, 
  AIResult, 
  AIProfile 
} from '../types/ai';
import { 
  mockPromptTemplates, 
  mockAIRuns, 
  mockAIResults, 
  generateMockAIResult 
} from './mockAIData';

interface DataContextType {
  companies: Company[];
  lists: List[];
  prospects: ProspectStatus[];
  createList: (name: string, filters: Filters | undefined, companyIds: string[], isPublic: boolean) => List;
  updateList: (listId: string, updates: Partial<List>) => void;
  deleteList: (listId: string) => void;
  getList: (listId: string) => List | undefined;
  addToProspects: (companyIds: string[]) => void;
  updateProspectStatus: (companyId: string, updates: Partial<ProspectStatus>) => void;
  addProspectNote: (companyId: string, note: string, author: string) => void;
  removeProspectNote: (companyId: string, noteIndex: number) => void;
  editProspectNote: (companyId: string, noteIndex: number, newText: string) => void;
  getCompany: (companyId: string) => Company | undefined;
  searchCompanies: (query: string) => Company[];
  
  // AI Analysis methods
  promptTemplates: PromptTemplate[];
  aiRuns: AIRun[];
  getTemplate: (templateId: string) => PromptTemplate | undefined;
  createTemplate: (template: Omit<PromptTemplate, 'id' | 'created_at' | 'created_by'>) => PromptTemplate;
  updateTemplate: (templateId: string, updates: Partial<PromptTemplate>) => void;
  duplicateTemplate: (templateId: string) => PromptTemplate;
  createAIRun: (name: string, listId: string, templateId: string, config: AIRun['config']) => AIRun;
  getAIRun: (runId: string) => AIRun | undefined;
  cancelAIRun: (runId: string) => void;
  getRunResults: (runId: string) => AIResult[];
  approveResult: (resultId: string) => void;
  rejectResult: (resultId: string) => void;
  getCompanyAIProfile: (companyOrgnr: string) => AIProfile | undefined;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [companies] = useState<Company[]>(mockCompanies);
  const [lists, setLists] = useState<List[]>([
    // Sample lists for demo
    {
      id: 'list_001',
      name: 'Q1 Manufacturing Targets',
      owner_user_id: 'user_001',
      scope: 'private',
      created_by: 'Sarah',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updated_by: 'Sarah',
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      stage: 'research',
      companyIds: mockCompanies.slice(0, 210).map(c => c.orgnr),
      filters: {
        include: {
          id: 'inc_root',
          type: 'and',
          rules: [
            { id: 'r1', field: 'revenue_latest', operator: 'gt', value: 5000000 },
            { id: 'r2', field: 'industry_label', operator: 'eq', value: 'Manufacturing' }
          ]
        },
        exclude: {
          id: 'exc_root',
          type: 'and',
          rules: [
            { id: 'r3', field: 'has_3y_financials', operator: 'eq', value: false }
          ]
        }
      }
    },
    {
      id: 'list_002',
      name: 'SaaS Prospects',
      owner_user_id: 'user_001',
      scope: 'private',
      created_by: 'Sarah',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updated_by: 'Sarah',
      updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      stage: 'research',
      companyIds: mockCompanies.filter(c => c.industry_label === 'Technology').slice(0, 85).map(c => c.orgnr),
      filters: {
        include: {
          id: 'inc_root',
          type: 'and',
          rules: [
            { id: 'r1', field: 'industry_label', operator: 'eq', value: 'Technology' }
          ]
        },
        exclude: {
          id: 'exc_root',
          type: 'and',
          rules: []
        }
      }
    },
    {
      id: 'list_003',
      name: 'High Growth Tech',
      owner_user_id: 'user_001',
      scope: 'private',
      created_by: 'Sarah',
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_by: 'Sarah',
      updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      stage: 'research',
      companyIds: mockCompanies.slice(100, 142).map(c => c.orgnr)
    }
  ]);

  const [prospects, setProspects] = useState<ProspectStatus[]>([
    {
      companyId: mockCompanies[0].orgnr,
      status: 'in_discussion',
      owner: 'Sarah',
      lastContact: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      notes: [
        {
          text: 'Called CEO yesterday - interested in exploratory chat. Sending overview deck by Friday. Schedule follow-up call for next Tuesday.',
          author: 'Sarah',
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        }
      ],
      nextAction: 'Send deck by Friday'
    },
    {
      companyId: mockCompanies[1].orgnr,
      status: 'contacted',
      owner: 'Mike',
      lastContact: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      notes: [
        {
          text: 'Sent intro email on Monday, no response yet. Will follow up early next week if no reply.',
          author: 'Mike',
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        }
      ],
      nextAction: 'Follow up on Tuesday'
    },
    {
      companyId: mockCompanies[2].orgnr,
      status: 'new',
      notes: []
    }
  ]);

  const createList = useCallback((name: string, filters: Filters | undefined, companyIds: string[], isPublic: boolean): List => {
    const now = new Date().toISOString();
    const newList: List = {
      id: `list_${Date.now()}`,
      name,
      owner_user_id: 'user_001', // In real app, would be current user ID
      scope: isPublic ? 'team' : 'private',
      created_by: 'Sarah',
      created_at: now,
      updated_by: 'Sarah',
      updated_at: now,
      filters,
      companyIds,
      stage: 'research'
    };
    setLists(prev => [...prev, newList]);
    return newList;
  }, []);

  const updateList = useCallback((listId: string, updates: Partial<List>) => {
    setLists(prev => prev.map(list => 
      list.id === listId ? { 
        ...list, 
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by: 'Sarah' // In real app, would be current user
      } : list
    ));
  }, []);

  const deleteList = useCallback((listId: string) => {
    setLists(prev => prev.filter(list => list.id !== listId));
  }, []);

  const getList = useCallback((listId: string) => {
    return lists.find(list => list.id === listId);
  }, [lists]);

  const addToProspects = useCallback((companyIds: string[]) => {
    const newProspects = companyIds
      .filter(id => !prospects.find(p => p.companyId === id))
      .map(id => ({
        companyId: id,
        status: 'new' as const,
        notes: []
      }));
    setProspects(prev => [...prev, ...newProspects]);
  }, [prospects]);

  const updateProspectStatus = useCallback((companyId: string, updates: Partial<ProspectStatus>) => {
    setProspects(prev => prev.map(prospect =>
      prospect.companyId === companyId ? { ...prospect, ...updates } : prospect
    ));
  }, []);

  const addProspectNote = useCallback((companyId: string, note: string, author: string) => {
    setProspects(prev => prev.map(prospect =>
      prospect.companyId === companyId
        ? {
            ...prospect,
            notes: [...prospect.notes, { text: note, author, date: new Date().toISOString() }],
            lastContact: new Date().toISOString()
          }
        : prospect
    ));
  }, []);

  const removeProspectNote = useCallback((companyId: string, noteIndex: number) => {
    setProspects(prev => prev.map(prospect =>
      prospect.companyId === companyId
        ? {
            ...prospect,
            notes: prospect.notes.filter((_, index) => index !== noteIndex),
            lastContact: new Date().toISOString()
          }
        : prospect
    ));
  }, []);

  const editProspectNote = useCallback((companyId: string, noteIndex: number, newText: string) => {
    setProspects(prev => prev.map(prospect =>
      prospect.companyId === companyId
        ? {
            ...prospect,
            notes: prospect.notes.map((note, index) => index === noteIndex ? { ...note, text: newText } : note),
            lastContact: new Date().toISOString()
          }
        : prospect
    ));
  }, []);

  const getCompany = useCallback((companyId: string) => {
    return companies.find(c => c.orgnr === companyId);
  }, [companies]);

  const searchCompanies = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return companies.filter(c => 
      c.display_name.toLowerCase().includes(lowerQuery) ||
      c.legal_name.toLowerCase().includes(lowerQuery) ||
      c.orgnr.includes(lowerQuery) ||
      c.industry_label.toLowerCase().includes(lowerQuery) ||
      (c.region && c.region.toLowerCase().includes(lowerQuery))
    ).slice(0, 50); // Limit results
  }, [companies]);

  // AI Analysis methods
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>(mockPromptTemplates);
  const [aiRuns, setAIRuns] = useState<AIRun[]>(mockAIRuns);
  const [aiResults, setAIResults] = useState<AIResult[]>(mockAIResults);

  const getTemplate = useCallback((templateId: string) => {
    return promptTemplates.find(template => template.id === templateId);
  }, [promptTemplates]);

  const createTemplate = useCallback((template: Omit<PromptTemplate, 'id' | 'created_at' | 'created_by'>) => {
    const now = new Date().toISOString();
    const newTemplate: PromptTemplate = {
      id: `template_${Date.now()}`,
      created_at: now,
      created_by: 'Sarah', // In real app, would be current user
      ...template
    };
    setPromptTemplates(prev => [...prev, newTemplate]);
    return newTemplate;
  }, []);

  const updateTemplate = useCallback((templateId: string, updates: Partial<PromptTemplate>) => {
    setPromptTemplates(prev => prev.map(template =>
      template.id === templateId ? { ...template, ...updates } : template
    ));
  }, []);

  const duplicateTemplate = useCallback((templateId: string) => {
    const template = promptTemplates.find(t => t.id === templateId);
    if (!template) throw new Error('Template not found');
    
    const now = new Date().toISOString();
    const newTemplate: PromptTemplate = {
      ...template,
      id: `template_${Date.now()}`,
      name: `${template.name} (Copy)`,
      created_at: now,
      created_by: 'Sarah' // In real app, would be current user
    };
    setPromptTemplates(prev => [...prev, newTemplate]);
    return newTemplate;
  }, [promptTemplates]);

  const createAIRun = useCallback((name: string, listId: string, templateId: string, config: AIRun['config']) => {
    const list = lists.find(l => l.id === listId);
    if (!list) throw new Error('List not found');
    
    const now = new Date().toISOString();
    const newRun: AIRun = {
      id: `run_${Date.now()}`,
      name,
      list_id: listId,
      template_id: templateId,
      status: 'queued',
      created_at: now,
      created_by: 'Sarah', // In real app, would be current user
      total_companies: list.companyIds.length,
      processed_companies: 0,
      failed_companies: 0,
      estimated_cost: list.companyIds.length * 0.20, // $0.20 per company estimate
      actual_cost: 0,
      config
    };
    setAIRuns(prev => [...prev, newRun]);
    
    // Simulate run starting after a delay
    setTimeout(() => {
      setAIRuns(prev => prev.map(run =>
        run.id === newRun.id ? { 
          ...run, 
          status: 'running', 
          started_at: new Date().toISOString() 
        } : run
      ));
      
      // Generate results for all companies in the list
      const results = list.companyIds.map(orgnr =>
        generateMockAIResult(newRun.id, orgnr, templateId, config.auto_approve)
      );
      setAIResults(prev => [...prev, ...results]);
      
      // Simulate completion after another delay
      setTimeout(() => {
        setAIRuns(prev => prev.map(run =>
          run.id === newRun.id ? {
            ...run,
            status: 'completed',
            completed_at: new Date().toISOString(),
            processed_companies: list.companyIds.length,
            actual_cost: list.companyIds.length * (0.15 + Math.random() * 0.10)
          } : run
        ));
      }, 3000);
    }, 1000);
    
    return newRun;
  }, [lists]);

  const getAIRun = useCallback((runId: string) => {
    return aiRuns.find(run => run.id === runId);
  }, [aiRuns]);

  const cancelAIRun = useCallback((runId: string) => {
    setAIRuns(prev => prev.map(run =>
      run.id === runId ? { ...run, status: 'cancelled' } : run
    ));
  }, []);

  const getRunResults = useCallback((runId: string) => {
    return aiResults.filter(result => result.run_id === runId);
  }, [aiResults]);

  const approveResult = useCallback((resultId: string) => {
    setAIResults(prev => prev.map(result =>
      result.id === resultId ? { 
        ...result, 
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: 'Sarah' // In real app, would be current user
      } : result
    ));
  }, []);

  const rejectResult = useCallback((resultId: string) => {
    setAIResults(prev => prev.map(result =>
      result.id === resultId ? { ...result, status: 'rejected' } : result
    ));
  }, []);

  const getCompanyAIProfile = useCallback((companyOrgnr: string) => {
    const companyResults = aiResults.filter(result => result.company_orgnr === companyOrgnr && result.status === 'approved');
    if (companyResults.length === 0) return undefined;
    
    // Get the most recent approved result
    const sortedResults = [...companyResults].sort((a, b) => 
      new Date(b.analyzed_at).getTime() - new Date(a.analyzed_at).getTime()
    );
    const latestResult = sortedResults[0];
    
    const profile: AIProfile = {
      company_orgnr: companyOrgnr,
      ai_fit_score: latestResult.overall_score,
      last_analyzed: latestResult.analyzed_at,
      analysis_count: companyResults.length,
      latest_result: latestResult
    };
    return profile;
  }, [aiResults]);

  return (
    <DataContext.Provider value={{
      companies,
      lists,
      prospects,
      createList,
      updateList,
      deleteList,
      getList,
      addToProspects,
      updateProspectStatus,
      addProspectNote,
      removeProspectNote,
      editProspectNote,
      getCompany,
      searchCompanies,
      
      // AI Analysis methods
      promptTemplates,
      aiRuns,
      getTemplate,
      createTemplate,
      updateTemplate,
      duplicateTemplate,
      createAIRun,
      getAIRun,
      cancelAIRun,
      getRunResults,
      approveResult,
      rejectResult,
      getCompanyAIProfile
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
}