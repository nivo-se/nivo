# Backend Integration Guide - Replace Mock Data with Real APIs

**Document Version:** 1.0  
**Date:** February 17, 2026  
**Purpose:** Complete mapping of all mock data usage for easy backend integration

---

## 🎯 Executive Summary

**Current State:** All data is currently mocked in React Context with local state management.  
**Target State:** Replace Context methods with API calls to your operational backend.  
**Primary File to Replace:** `/src/app/data/DataContext.tsx` (457 lines)

---

## 📍 All Mock Data Locations

### 1. Mock Data Files (DELETE THESE AFTER MIGRATION)

```
/src/app/data/
├── DataContext.tsx          ← Main file to replace (457 lines)
├── mockData.ts              ← 13,421 mock companies + types (DELETE)
└── mockAIData.ts            ← Mock AI templates, runs, results (DELETE)
```

---

## 🔧 Complete Replacement Strategy

### Option 1: Create API Service Layer (RECOMMENDED)

Create new file: `/src/app/services/api.ts`

```typescript
// /src/app/services/api.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Add auth token to all requests
function getHeaders() {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

// Export all API methods
export const api = {
  // Companies
  getCompanies: () => apiRequest<Company[]>('/companies'),
  getCompany: (orgnr: string) => apiRequest<Company>(`/companies/${orgnr}`),
  searchCompanies: (query: string) => apiRequest<Company[]>(`/companies/search?q=${encodeURIComponent(query)}`),
  
  // Lists
  getLists: () => apiRequest<List[]>('/lists'),
  getList: (listId: string) => apiRequest<List>(`/lists/${listId}`),
  createList: (data: CreateListDTO) => apiRequest<List>('/lists', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateList: (listId: string, data: Partial<List>) => apiRequest<List>(`/lists/${listId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteList: (listId: string) => apiRequest<void>(`/lists/${listId}`, {
    method: 'DELETE'
  }),
  
  // Prospects
  getProspects: () => apiRequest<ProspectStatus[]>('/prospects'),
  getProspect: (prospectId: string) => apiRequest<ProspectStatus>(`/prospects/${prospectId}`),
  createProspect: (companyId: string) => apiRequest<ProspectStatus>('/prospects', {
    method: 'POST',
    body: JSON.stringify({ companyId, status: 'new' })
  }),
  updateProspectStatus: (prospectId: string, updates: Partial<ProspectStatus>) => 
    apiRequest<ProspectStatus>(`/prospects/${prospectId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),
  addProspectNote: (prospectId: string, note: { text: string; author: string }) => 
    apiRequest<ProspectStatus>(`/prospects/${prospectId}/notes`, {
      method: 'POST',
      body: JSON.stringify(note)
    }),
  updateProspectNote: (prospectId: string, noteIndex: number, text: string) =>
    apiRequest<ProspectStatus>(`/prospects/${prospectId}/notes/${noteIndex}`, {
      method: 'PUT',
      body: JSON.stringify({ text })
    }),
  deleteProspectNote: (prospectId: string, noteIndex: number) =>
    apiRequest<void>(`/prospects/${prospectId}/notes/${noteIndex}`, {
      method: 'DELETE'
    }),
  
  // AI Analysis
  getPromptTemplates: () => apiRequest<PromptTemplate[]>('/ai/templates'),
  getPromptTemplate: (templateId: string) => apiRequest<PromptTemplate>(`/ai/templates/${templateId}`),
  createPromptTemplate: (data: Omit<PromptTemplate, 'id' | 'created_at' | 'created_by'>) => 
    apiRequest<PromptTemplate>('/ai/templates', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updatePromptTemplate: (templateId: string, data: Partial<PromptTemplate>) =>
    apiRequest<PromptTemplate>(`/ai/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  duplicatePromptTemplate: (templateId: string) =>
    apiRequest<PromptTemplate>(`/ai/templates/${templateId}/duplicate`, {
      method: 'POST'
    }),
  
  // AI Runs
  getAIRuns: () => apiRequest<AIRun[]>('/ai/runs'),
  getAIRun: (runId: string) => apiRequest<AIRun>(`/ai/runs/${runId}`),
  createAIRun: (data: CreateAIRunDTO) => apiRequest<AIRun>('/ai/runs', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  cancelAIRun: (runId: string) => apiRequest<AIRun>(`/ai/runs/${runId}/cancel`, {
    method: 'POST'
  }),
  
  // AI Results
  getRunResults: (runId: string) => apiRequest<AIResult[]>(`/ai/runs/${runId}/results`),
  approveResult: (resultId: string) => apiRequest<AIResult>(`/ai/results/${resultId}/approve`, {
    method: 'POST'
  }),
  rejectResult: (resultId: string) => apiRequest<AIResult>(`/ai/results/${resultId}/reject`, {
    method: 'POST'
  }),
  getCompanyAIProfile: (orgnr: string) => apiRequest<AIProfile | null>(`/ai/profiles/${orgnr}`),
};
```

### Option 2: Replace DataContext with React Query (MODERN APPROACH)

Install React Query:
```bash
npm install @tanstack/react-query
```

Create new file: `/src/app/data/queries.ts`

```typescript
// /src/app/data/queries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

// Companies
export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: api.getCompanies,
  });
}

export function useCompany(orgnr: string) {
  return useQuery({
    queryKey: ['companies', orgnr],
    queryFn: () => api.getCompany(orgnr),
    enabled: !!orgnr,
  });
}

// Lists
export function useLists() {
  return useQuery({
    queryKey: ['lists'],
    queryFn: api.getLists,
  });
}

export function useList(listId: string) {
  return useQuery({
    queryKey: ['lists', listId],
    queryFn: () => api.getList(listId),
    enabled: !!listId,
  });
}

export function useCreateList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

export function useUpdateList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, data }: { listId: string; data: Partial<List> }) =>
      api.updateList(listId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lists', variables.listId] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

export function useDeleteList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

// Prospects
export function useProspects() {
  return useQuery({
    queryKey: ['prospects'],
    queryFn: api.getProspects,
  });
}

export function useUpdateProspectStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ prospectId, updates }: { prospectId: string; updates: Partial<ProspectStatus> }) =>
      api.updateProspectStatus(prospectId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
}

export function useAddProspectNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ prospectId, note }: { prospectId: string; note: { text: string; author: string } }) =>
      api.addProspectNote(prospectId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
}

// AI Analysis
export function usePromptTemplates() {
  return useQuery({
    queryKey: ['promptTemplates'],
    queryFn: api.getPromptTemplates,
  });
}

export function useAIRuns() {
  return useQuery({
    queryKey: ['aiRuns'],
    queryFn: api.getAIRuns,
  });
}

export function useAIRun(runId: string) {
  return useQuery({
    queryKey: ['aiRuns', runId],
    queryFn: () => api.getAIRun(runId),
    enabled: !!runId,
    refetchInterval: (data) => {
      // Auto-refetch every 2 seconds if running
      return data?.status === 'running' || data?.status === 'queued' ? 2000 : false;
    },
  });
}

export function useCreateAIRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createAIRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiRuns'] });
    },
  });
}

export function useRunResults(runId: string) {
  return useQuery({
    queryKey: ['aiRuns', runId, 'results'],
    queryFn: () => api.getRunResults(runId),
    enabled: !!runId,
  });
}

export function useApproveResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.approveResult,
    onSuccess: (_, resultId) => {
      // Invalidate both the specific run results and AI profiles
      queryClient.invalidateQueries({ queryKey: ['aiRuns'] });
    },
  });
}

export function useCompanyAIProfile(orgnr: string) {
  return useQuery({
    queryKey: ['aiProfiles', orgnr],
    queryFn: () => api.getCompanyAIProfile(orgnr),
    enabled: !!orgnr,
  });
}
```

---

## 📋 API Endpoint Mapping

### Complete Backend API Structure Expected

```typescript
// ============================================================================
// COMPANIES API
// ============================================================================

GET    /api/companies
  → Returns: Company[] (all 13,421 companies)
  → Query params: ?page=1&limit=100&filters=...
  → Used in: Universe.tsx line 12

GET    /api/companies/:orgnr
  → Returns: Company (single company)
  → Used in: CompanyDetail.tsx line 12

GET    /api/companies/search?q={query}
  → Returns: Company[] (search results, max 50)
  → Used in: Universe.tsx (search input), CreateRun.tsx (company picker)

// ============================================================================
// LISTS API
// ============================================================================

GET    /api/lists
  → Returns: List[] (all user's lists)
  → Used in: WorkDashboard.tsx line 8, MyLists.tsx line 8

GET    /api/lists/:listId
  → Returns: List (single list with all details)
  → Used in: ListDetail.tsx line 14

POST   /api/lists
  → Body: {
      name: string,
      scope: 'private' | 'team',
      stage: 'research' | 'ai_analysis' | 'finalists',
      companyIds: string[],
      filters?: Filters
    }
  → Returns: List (newly created)
  → Used in: Universe.tsx line 12 (createList function)

PUT    /api/lists/:listId
  → Body: Partial<List> (any list fields to update)
  → Returns: List (updated)
  → Used in: ListDetail.tsx line 14 (updateList function)

DELETE /api/lists/:listId
  → Returns: void
  → Used in: MyLists.tsx line 8 (deleteList function)

// ============================================================================
// PROSPECTS API
// ============================================================================

GET    /api/prospects
  → Returns: ProspectStatus[] (all prospects)
  → Used in: WorkDashboard.tsx line 8, Prospects.tsx line 25

GET    /api/prospects/:prospectId
  → Returns: ProspectStatus (single prospect)
  → Note: Currently not used, but recommended for future

POST   /api/prospects
  → Body: { companyId: string, status: 'new' }
  → Returns: ProspectStatus (newly created)
  → Used in: ListDetail.tsx line 14, CompanyDetail.tsx (addToProspects)

PATCH  /api/prospects/:prospectId
  → Body: Partial<ProspectStatus> (e.g., { status: 'contacted', owner: 'Sarah' })
  → Returns: ProspectStatus (updated)
  → Used in: Prospects.tsx line 25 (updateProspectStatus)

POST   /api/prospects/:prospectId/notes
  → Body: { text: string, author: string }
  → Returns: ProspectStatus (with new note added)
  → Used in: Prospects.tsx line 25 (addProspectNote)

PUT    /api/prospects/:prospectId/notes/:noteIndex
  → Body: { text: string }
  → Returns: ProspectStatus (with note updated)
  → Used in: Prospects.tsx line 25 (editProspectNote)

DELETE /api/prospects/:prospectId/notes/:noteIndex
  → Returns: ProspectStatus (with note removed)
  → Used in: Prospects.tsx line 25 (removeProspectNote)

// ============================================================================
// AI TEMPLATES API
// ============================================================================

GET    /api/ai/templates
  → Returns: PromptTemplate[] (all templates)
  → Used in: AILab.tsx line 27, CreateRun.tsx line 14

GET    /api/ai/templates/:templateId
  → Returns: PromptTemplate (single template)
  → Used in: CreateRun.tsx line 14 (getTemplate)

POST   /api/ai/templates
  → Body: {
      name: string,
      description: string,
      prompt_text: string,
      system_message?: string,
      variables?: string[],
      example_output?: string
    }
  → Returns: PromptTemplate (newly created)
  → Used in: AILab.tsx line 27 (createTemplate)

PUT    /api/ai/templates/:templateId
  → Body: Partial<PromptTemplate>
  → Returns: PromptTemplate (updated)
  → Used in: AILab.tsx line 27 (updateTemplate)

POST   /api/ai/templates/:templateId/duplicate
  → Returns: PromptTemplate (duplicated with new ID)
  → Used in: AILab.tsx line 27 (duplicateTemplate)

// ============================================================================
// AI RUNS API
// ============================================================================

GET    /api/ai/runs
  → Returns: AIRun[] (all runs, sorted by created_at desc)
  → Used in: WorkDashboard.tsx, AILab.tsx line 27, Admin.tsx line 80

GET    /api/ai/runs/:runId
  → Returns: AIRun (single run with status, progress)
  → Used in: RunDetail.tsx line 22
  → NOTE: Frontend polls this every 2 seconds while status = 'running' or 'queued'

POST   /api/ai/runs
  → Body: {
      name: string,
      list_id: string,
      template_id: string,
      config: {
        model: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo',
        temperature: number,
        max_tokens: number,
        auto_approve: boolean
      }
    }
  → Returns: AIRun (newly created with status 'queued')
  → Used in: CreateRun.tsx line 14 (createAIRun)
  → Backend should: 
      1. Create run record
      2. Queue background job to process companies
      3. Return immediately with run ID

POST   /api/ai/runs/:runId/cancel
  → Returns: AIRun (with status = 'cancelled')
  → Used in: RunDetail.tsx line 22 (cancelAIRun)

// ============================================================================
// AI RESULTS API
// ============================================================================

GET    /api/ai/runs/:runId/results
  → Returns: AIResult[] (all results for this run)
  → Used in: RunResults.tsx line 22

POST   /api/ai/results/:resultId/approve
  → Returns: AIResult (with status = 'approved')
  → Used in: RunResults.tsx line 22 (approveResult)
  → Side effect: Should also create/update prospect record

POST   /api/ai/results/:resultId/reject
  → Returns: AIResult (with status = 'rejected')
  → Used in: RunResults.tsx line 22 (rejectResult)

GET    /api/ai/profiles/:orgnr
  → Returns: AIProfile | null (aggregated AI analysis for company)
  → Used in: CompanyDetail.tsx line 12 (getCompanyAIProfile)
  → Should return most recent approved analysis + count

// ============================================================================
// ADMIN / SYSTEM API (Future)
// ============================================================================

GET    /api/admin/system-health
  → Returns: { status: 'operational', database: 'connected', api: 'connected' }

GET    /api/admin/audit-log?from=date&to=date&user=userId&action=type
  → Returns: AuditLogEntry[]

GET    /api/admin/team
  → Returns: TeamMember[]

POST   /api/admin/team
  → Body: { name, email, role }
  → Returns: TeamMember

// ============================================================================
// AUTHENTICATION (if needed)
// ============================================================================

POST   /api/auth/login
  → Body: { email, password }
  → Returns: { token: string, user: User }

POST   /api/auth/logout
  → Returns: void

GET    /api/auth/me
  → Returns: User (current user)
```

---

## 🔍 Detailed File-by-File Usage

### `/src/app/data/DataContext.tsx` - **PRIMARY FILE TO REPLACE**

**Lines 1-14:** Import mock data
```typescript
// CURRENT (MOCK):
import { Company, List, ProspectStatus, Filters, mockCompanies } from './mockData';
import { mockPromptTemplates, mockAIRuns, mockAIResults, generateMockAIResult } from './mockAIData';

// REPLACE WITH:
import { api } from '../services/api';
import type { Company, List, ProspectStatus, Filters, PromptTemplate, AIRun, AIResult, AIProfile } from '../types';
```

**Lines 51:** Mock companies initialization
```typescript
// CURRENT (MOCK):
const [companies] = useState<Company[]>(mockCompanies);

// REPLACE WITH (React Query approach):
const { data: companies = [], isLoading } = useQuery({
  queryKey: ['companies'],
  queryFn: api.getCompanies
});

// OR (Traditional approach - fetch on mount):
const [companies, setCompanies] = useState<Company[]>([]);
useEffect(() => {
  api.getCompanies().then(setCompanies);
}, []);
```

**Lines 52-121:** Mock lists initialization
```typescript
// CURRENT (MOCK): Hard-coded 3 sample lists

// REPLACE WITH:
const [lists, setLists] = useState<List[]>([]);
useEffect(() => {
  api.getLists().then(setLists);
}, []);
```

**Lines 123-157:** Mock prospects initialization
```typescript
// CURRENT (MOCK): Hard-coded 3 sample prospects

// REPLACE WITH:
const [prospects, setProspects] = useState<ProspectStatus[]>([]);
useEffect(() => {
  api.getProspects().then(setProspects);
}, []);
```

**Lines 159-176:** createList function
```typescript
// CURRENT (MOCK): Local state update
const createList = useCallback((name: string, filters: Filters | undefined, companyIds: string[], isPublic: boolean): List => {
  const newList: List = { /* ... */ };
  setLists(prev => [...prev, newList]);
  return newList;
}, []);

// REPLACE WITH:
const createList = useCallback(async (name: string, filters: Filters | undefined, companyIds: string[], isPublic: boolean): Promise<List> => {
  const newList = await api.createList({
    name,
    scope: isPublic ? 'team' : 'private',
    stage: 'research',
    companyIds,
    filters
  });
  setLists(prev => [...prev, newList]);
  return newList;
}, []);
```

**Lines 178-187:** updateList function
```typescript
// CURRENT (MOCK):
const updateList = useCallback((listId: string, updates: Partial<List>) => {
  setLists(prev => prev.map(list => list.id === listId ? { ...list, ...updates } : list));
}, []);

// REPLACE WITH:
const updateList = useCallback(async (listId: string, updates: Partial<List>) => {
  const updatedList = await api.updateList(listId, updates);
  setLists(prev => prev.map(list => list.id === listId ? updatedList : list));
}, []);
```

**Lines 189-191:** deleteList function
```typescript
// CURRENT (MOCK):
const deleteList = useCallback((listId: string) => {
  setLists(prev => prev.filter(list => list.id !== listId));
}, []);

// REPLACE WITH:
const deleteList = useCallback(async (listId: string) => {
  await api.deleteList(listId);
  setLists(prev => prev.filter(list => list.id !== listId));
}, []);
```

**Lines 197-206:** addToProspects function
```typescript
// CURRENT (MOCK):
const addToProspects = useCallback((companyIds: string[]) => {
  const newProspects = companyIds.map(id => ({ companyId: id, status: 'new', notes: [] }));
  setProspects(prev => [...prev, ...newProspects]);
}, [prospects]);

// REPLACE WITH:
const addToProspects = useCallback(async (companyIds: string[]) => {
  const newProspects = await Promise.all(
    companyIds.map(id => api.createProspect(id))
  );
  setProspects(prev => [...prev, ...newProspects]);
}, []);
```

**Lines 208-212:** updateProspectStatus function
```typescript
// CURRENT (MOCK):
const updateProspectStatus = useCallback((companyId: string, updates: Partial<ProspectStatus>) => {
  setProspects(prev => prev.map(prospect => prospect.companyId === companyId ? { ...prospect, ...updates } : prospect));
}, []);

// REPLACE WITH:
const updateProspectStatus = useCallback(async (prospectId: string, updates: Partial<ProspectStatus>) => {
  const updated = await api.updateProspectStatus(prospectId, updates);
  setProspects(prev => prev.map(prospect => prospect.id === prospectId ? updated : prospect));
}, []);
```

**Lines 214-224:** addProspectNote function
```typescript
// CURRENT (MOCK):
const addProspectNote = useCallback((companyId: string, note: string, author: string) => {
  setProspects(prev => prev.map(prospect =>
    prospect.companyId === companyId
      ? { ...prospect, notes: [...prospect.notes, { text: note, author, date: new Date().toISOString() }] }
      : prospect
  ));
}, []);

// REPLACE WITH:
const addProspectNote = useCallback(async (prospectId: string, note: string, author: string) => {
  const updated = await api.addProspectNote(prospectId, { text: note, author });
  setProspects(prev => prev.map(prospect => prospect.id === prospectId ? updated : prospect));
}, []);
```

**Lines 308-361:** createAIRun function
```typescript
// CURRENT (MOCK): Simulates run with setTimeout, generates fake results

// REPLACE WITH:
const createAIRun = useCallback(async (name: string, listId: string, templateId: string, config: AIRun['config']): Promise<AIRun> => {
  const newRun = await api.createAIRun({ name, list_id: listId, template_id: templateId, config });
  setAIRuns(prev => [...prev, newRun]);
  return newRun;
  // Note: Backend handles the actual processing asynchronously
  // Frontend will poll /api/ai/runs/:runId for status updates
}, []);
```

**Lines 363-365:** getAIRun function
```typescript
// CURRENT (MOCK): Finds in local state

// REPLACE WITH:
const getAIRun = useCallback(async (runId: string): Promise<AIRun | undefined> => {
  try {
    return await api.getAIRun(runId);
  } catch {
    return undefined;
  }
}, []);
```

**Lines 367-371:** cancelAIRun function
```typescript
// CURRENT (MOCK):
const cancelAIRun = useCallback((runId: string) => {
  setAIRuns(prev => prev.map(run => run.id === runId ? { ...run, status: 'cancelled' } : run));
}, []);

// REPLACE WITH:
const cancelAIRun = useCallback(async (runId: string) => {
  const updated = await api.cancelAIRun(runId);
  setAIRuns(prev => prev.map(run => run.id === runId ? updated : run));
}, []);
```

**Lines 373-375:** getRunResults function
```typescript
// CURRENT (MOCK):
const getRunResults = useCallback((runId: string) => {
  return aiResults.filter(result => result.run_id === runId);
}, [aiResults]);

// REPLACE WITH:
const getRunResults = useCallback(async (runId: string): Promise<AIResult[]> => {
  return await api.getRunResults(runId);
}, []);
```

**Lines 377-386:** approveResult function
```typescript
// CURRENT (MOCK):
const approveResult = useCallback((resultId: string) => {
  setAIResults(prev => prev.map(result =>
    result.id === resultId ? { ...result, status: 'approved', approved_at: new Date().toISOString() } : result
  ));
}, []);

// REPLACE WITH:
const approveResult = useCallback(async (resultId: string) => {
  const updated = await api.approveResult(resultId);
  setAIResults(prev => prev.map(result => result.id === resultId ? updated : result));
  // Backend should also create prospect record
}, []);
```

**Lines 388-392:** rejectResult function
```typescript
// CURRENT (MOCK):
const rejectResult = useCallback((resultId: string) => {
  setAIResults(prev => prev.map(result =>
    result.id === resultId ? { ...result, status: 'rejected' } : result
  ));
}, []);

// REPLACE WITH:
const rejectResult = useCallback(async (resultId: string) => {
  const updated = await api.rejectResult(resultId);
  setAIResults(prev => prev.map(result => result.id === resultId ? updated : result));
}, []);
```

**Lines 394-412:** getCompanyAIProfile function
```typescript
// CURRENT (MOCK): Filters local aiResults array

// REPLACE WITH:
const getCompanyAIProfile = useCallback(async (companyOrgnr: string): Promise<AIProfile | undefined> => {
  try {
    return await api.getCompanyAIProfile(companyOrgnr);
  } catch {
    return undefined;
  }
}, []);
```

---

## 📄 Page-Level Changes Required

### `/src/app/pages/Universe.tsx`

**Current (line 12):**
```typescript
const { companies, createList } = useData();
```

**After API integration:**
```typescript
const { data: companies = [], isLoading } = useCompanies();
const createListMutation = useCreateList();
```

**Update createList calls:**
```typescript
// Old:
const newList = createList(name, filters, selectedCompanyIds, isPublic);

// New:
await createListMutation.mutateAsync({ name, filters, companyIds: selectedCompanyIds, scope: isPublic ? 'team' : 'private' });
```

---

### `/src/app/pages/WorkDashboard.tsx`

**Current (line 8):**
```typescript
const { companies, lists, prospects } = useData();
```

**After API integration:**
```typescript
const { data: companies = [] } = useCompanies();
const { data: lists = [] } = useLists();
const { data: prospects = [] } = useProspects();
```

---

### `/src/app/pages/MyLists.tsx`

**Current (line 8):**
```typescript
const { lists, deleteList } = useData();
```

**After API integration:**
```typescript
const { data: lists = [] } = useLists();
const deleteListMutation = useDeleteList();

// Update delete call:
await deleteListMutation.mutateAsync(listId);
```

---

### `/src/app/pages/ListDetail.tsx`

**Current (line 14):**
```typescript
const { getList, updateList, companies, getCompany, addToProspects } = useData();
const list = getList(listId!);
```

**After API integration:**
```typescript
const { data: list } = useList(listId!);
const { data: companies = [] } = useCompanies();
const updateListMutation = useUpdateList();
const createProspectMutation = useCreateProspect();

// Update calls:
await updateListMutation.mutateAsync({ listId: listId!, data: updates });
await createProspectMutation.mutateAsync({ companyId });
```

---

### `/src/app/pages/Prospects.tsx`

**Current (line 25):**
```typescript
const { prospects, getCompany, updateProspectStatus, addProspectNote, removeProspectNote, editProspectNote } = useData();
```

**After API integration:**
```typescript
const { data: prospects = [] } = useProspects();
const { data: companies = [] } = useCompanies();
const updateStatusMutation = useUpdateProspectStatus();
const addNoteMutation = useAddProspectNote();
const deleteNoteMutation = useDeleteProspectNote();
const updateNoteMutation = useUpdateProspectNote();

// Update calls:
await updateStatusMutation.mutateAsync({ prospectId, updates: { status: newStatus } });
await addNoteMutation.mutateAsync({ prospectId, note: { text, author } });
```

---

### `/src/app/pages/CompanyDetail.tsx`

**Current (line 12):**
```typescript
const { getCompany, getCompanyAIProfile } = useData();
const company = getCompany(companyId!);
const aiProfile = company ? getCompanyAIProfile(company.orgnr) : null;
```

**After API integration:**
```typescript
const { data: company } = useCompany(companyId!);
const { data: aiProfile } = useCompanyAIProfile(company?.orgnr || '');
```

---

### `/src/app/pages/AILab.tsx`

**Current (line 27):**
```typescript
const { promptTemplates, aiRuns, lists, updateTemplate, duplicateTemplate, createTemplate } = useData();
```

**After API integration:**
```typescript
const { data: promptTemplates = [] } = usePromptTemplates();
const { data: aiRuns = [] } = useAIRuns();
const { data: lists = [] } = useLists();
const updateTemplateMutation = useUpdateTemplate();
const duplicateTemplateMutation = useDuplicateTemplate();
const createTemplateMutation = useCreateTemplate();
```

---

### `/src/app/pages/CreateRun.tsx`

**Current (line 14):**
```typescript
const { getTemplate, getList, createAIRun } = useData();
```

**After API integration:**
```typescript
const { data: template } = usePromptTemplate(templateId!);
const { data: list } = useList(listId!);
const createRunMutation = useCreateAIRun();

// Update create call:
const newRun = await createRunMutation.mutateAsync({
  name,
  list_id: listId!,
  template_id: templateId!,
  config
});
navigate(`/ai-lab/runs/${newRun.id}`);
```

---

### `/src/app/pages/RunDetail.tsx`

**Current (line 22):**
```typescript
const { getAIRun, getList, getTemplate, getRunResults, cancelAIRun } = useData();
const [run, setRun] = useState(getAIRun(runId!));
```

**After API integration:**
```typescript
const { data: run, refetch } = useAIRun(runId!); // Auto-refetches every 2s if running
const { data: list } = useList(run?.list_id || '');
const { data: template } = usePromptTemplate(run?.template_id || '');
const { data: results = [] } = useRunResults(runId!);
const cancelRunMutation = useCancelAIRun();

// React Query will auto-refetch while status = 'running'
// No need for manual polling!
```

---

### `/src/app/pages/RunResults.tsx`

**Current (line 22):**
```typescript
const { getAIRun, getRunResults, getCompany, getTemplate, approveResult, rejectResult } = useData();
const run = getAIRun(runId!);
const results = getRunResults(runId!);
```

**After API integration:**
```typescript
const { data: run } = useAIRun(runId!);
const { data: results = [] } = useRunResults(runId!);
const { data: companies = [] } = useCompanies();
const { data: template } = usePromptTemplate(run?.template_id || '');
const approveResultMutation = useApproveResult();
const rejectResultMutation = useRejectResult();

// Update calls:
await approveResultMutation.mutateAsync(resultId);
await rejectResultMutation.mutateAsync(resultId);
```

---

### `/src/app/pages/Admin.tsx`

**Current (line 80):**
```typescript
const { lists, prospects, aiRuns, companies } = useData();
```

**After API integration:**
```typescript
const { data: lists = [] } = useLists();
const { data: prospects = [] } = useProspects();
const { data: aiRuns = [] } = useAIRuns();
const { data: companies = [] } = useCompanies();
```

---

## 🚀 Migration Steps

### Step 1: Install Dependencies (if using React Query)

```bash
npm install @tanstack/react-query
```

### Step 2: Create API Service Layer

Create `/src/app/services/api.ts` with all API methods (see Option 1 above)

### Step 3: Create Types File

Move types from `mockData.ts` to `/src/app/types/index.ts`:

```typescript
// /src/app/types/index.ts
export interface Company {
  orgnr: string;
  display_name: string;
  legal_name: string;
  industry_label: string;
  region?: string;
  revenue_latest?: number;
  ebitda_latest?: number;
  employees_latest?: number;
  // ... all other fields from mockData.ts
}

export interface List {
  id: string;
  name: string;
  owner_user_id: string;
  scope: 'private' | 'team';
  stage: 'research' | 'ai_analysis' | 'finalists';
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  companyIds: string[];
  filters?: Filters;
}

export interface ProspectStatus {
  id: string;
  companyId: string;
  status: 'new' | 'researching' | 'contacted' | 'in_discussion' | 'meeting_scheduled' | 'interested' | 'not_interested' | 'passed' | 'deal_in_progress';
  owner?: string;
  lastContact?: string;
  notes: Array<{
    text: string;
    author: string;
    date: string;
  }>;
  nextAction?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  prompt_text: string;
  system_message?: string;
  variables?: string[];
  example_output?: string;
  created_at: string;
  created_by: string;
}

export interface AIRun {
  id: string;
  name: string;
  list_id: string;
  template_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  created_by: string;
  started_at?: string;
  completed_at?: string;
  total_companies: number;
  processed_companies: number;
  failed_companies: number;
  estimated_cost: number;
  actual_cost: number;
  config: {
    model: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo';
    temperature: number;
    max_tokens: number;
    auto_approve: boolean;
  };
}

export interface AIResult {
  id: string;
  run_id: string;
  company_orgnr: string;
  template_id: string;
  status: 'pending' | 'approved' | 'rejected';
  overall_score: number;
  analysis_text: string;
  key_findings: string[];
  recommendation: 'strong_fit' | 'moderate_fit' | 'weak_fit' | 'not_recommended';
  analyzed_at: string;
  approved_at?: string;
  approved_by?: string;
}

export interface AIProfile {
  company_orgnr: string;
  ai_fit_score: number;
  last_analyzed: string;
  analysis_count: number;
  latest_result: AIResult;
}

export interface Filters {
  include: FilterGroup;
  exclude: FilterGroup;
}

export interface FilterGroup {
  id: string;
  type: 'and' | 'or';
  rules: FilterRule[];
}

export interface FilterRule {
  id: string;
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
  value: any;
}
```

### Step 4: Setup React Query Provider (if using React Query)

Update `/src/app/App.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Step 5: Create Custom Hooks (if using React Query)

Create `/src/app/hooks/queries.ts` with all the useQuery/useMutation hooks shown above

### Step 6: Update All Pages

Go through each page listed above and update from `useData()` to individual hooks

### Step 7: Test Incrementally

1. Start with read-only pages (Dashboard, Universe view)
2. Then add write operations (create list, update prospect)
3. Finally add AI analysis flows

### Step 8: Remove Mock Data Files

Once everything works:
```bash
rm /src/app/data/mockData.ts
rm /src/app/data/mockAIData.ts
rm /src/app/data/DataContext.tsx  # Or keep as shell for backward compat
```

---

## 🔐 Authentication Considerations

If your backend requires authentication, update `/src/app/services/api.ts`:

```typescript
// Store token after login
export function setAuthToken(token: string) {
  localStorage.setItem('authToken', token);
}

// Clear token on logout
export function clearAuthToken() {
  localStorage.removeItem('authToken');
}

// Get current token
export function getAuthToken() {
  return localStorage.getItem('authToken');
}

// Check if authenticated
export function isAuthenticated() {
  return !!getAuthToken();
}

// Add to all fetch requests
function getHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
}
```

Add authentication check to Root.tsx:

```typescript
// /src/app/pages/Root.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { isAuthenticated } from '../services/api';

export default function Root() {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
    }
  }, [navigate]);
  
  // ... rest of component
}
```

---

## 📊 Expected Backend Data Structures

### Company Entity (from your backend)

```typescript
interface Company {
  orgnr: string;                    // Primary key, e.g., "123456789"
  display_name: string;             // "Acme Corp"
  legal_name: string;               // "Acme Corporation AB"
  industry_label: string;           // "Manufacturing"
  industry_code?: string;           // "25.110"
  region?: string;                  // "Stockholm"
  municipality?: string;            // "Stockholm"
  address?: string;
  postal_code?: string;
  founded_year?: number;
  website?: string;
  
  // Financial data (latest year)
  revenue_latest?: number;          // in SEK
  ebitda_latest?: number;
  gross_margin_latest?: number;     // as decimal (0.35 = 35%)
  employees_latest?: number;
  
  // Historical data (4 years)
  revenue_y1?: number;
  revenue_y2?: number;
  revenue_y3?: number;
  revenue_y4?: number;
  ebitda_y1?: number;
  ebitda_y2?: number;
  ebitda_y3?: number;
  ebitda_y4?: number;
  employees_y1?: number;
  employees_y2?: number;
  employees_y3?: number;
  employees_y4?: number;
  
  // Data coverage flags
  has_revenue?: boolean;
  has_ebitda?: boolean;
  has_employees?: boolean;
  has_3y_financials?: boolean;
  has_4y_financials?: boolean;
  
  // Timestamps
  data_updated_at?: string;
}
```

### List Entity

```typescript
interface List {
  id: string;                       // "list_abc123"
  name: string;                     // "Q1 Manufacturing Targets"
  owner_user_id: string;            // Foreign key to users table
  scope: 'private' | 'team';        // Visibility
  stage: 'research' | 'ai_analysis' | 'finalists';
  created_by: string;               // User name/ID
  created_at: string;               // ISO 8601 timestamp
  updated_by: string;
  updated_at: string;
  companyIds: string[];             // Array of orgnr
  filters?: Filters;                // Optional: original filters used
}
```

### ProspectStatus Entity

```typescript
interface ProspectStatus {
  id: string;                       // "prospect_abc123"
  companyId: string;                // orgnr (foreign key)
  status: 'new' | 'researching' | 'contacted' | 'in_discussion' | 'meeting_scheduled' | 'interested' | 'not_interested' | 'passed' | 'deal_in_progress';
  owner?: string;                   // Assigned team member
  lastContact?: string;             // ISO 8601 timestamp
  notes: Array<{
    text: string;
    author: string;
    date: string;                   // ISO 8601
  }>;
  nextAction?: string;              // Free text
  priority?: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}
```

### AIRun Entity

```typescript
interface AIRun {
  id: string;                       // "run_abc123"
  name: string;                     // "Q1 Batch - Strategic Fit"
  list_id: string;                  // Foreign key
  template_id: string;              // Foreign key
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  created_by: string;               // User ID
  started_at?: string;
  completed_at?: string;
  total_companies: number;          // Count from list
  processed_companies: number;      // Increments as processed
  failed_companies: number;         // Count of failures
  estimated_cost: number;           // USD, calculated upfront
  actual_cost: number;              // USD, updated as run progresses
  config: {
    model: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo';
    temperature: number;            // 0-1
    max_tokens: number;
    auto_approve: boolean;          // If true, auto-approve results
  };
}
```

### AIResult Entity

```typescript
interface AIResult {
  id: string;                       // "result_abc123"
  run_id: string;                   // Foreign key
  company_orgnr: string;            // Foreign key
  template_id: string;              // Foreign key
  status: 'pending' | 'approved' | 'rejected';
  overall_score: number;            // 0-100
  analysis_text: string;            // Full AI-generated text
  key_findings: string[];           // Bullet points
  recommendation: 'strong_fit' | 'moderate_fit' | 'weak_fit' | 'not_recommended';
  analyzed_at: string;              // ISO 8601
  approved_at?: string;
  approved_by?: string;             // User ID
  tokens_used?: number;             // For cost tracking
  cost?: number;                    // USD
}
```

---

## 🧪 Testing Your Backend Integration

### Test Checklist

1. **Companies Endpoint**
   - [ ] GET /api/companies returns all 13k companies
   - [ ] GET /api/companies/:orgnr returns single company
   - [ ] GET /api/companies/search?q=test returns search results
   - [ ] All company fields match TypeScript types

2. **Lists Endpoint**
   - [ ] GET /api/lists returns user's lists
   - [ ] POST /api/lists creates new list
   - [ ] PUT /api/lists/:id updates list
   - [ ] DELETE /api/lists/:id deletes list
   - [ ] List creation includes all companyIds

3. **Prospects Endpoint**
   - [ ] GET /api/prospects returns all prospects
   - [ ] POST /api/prospects creates new prospect
   - [ ] PATCH /api/prospects/:id updates status
   - [ ] POST /api/prospects/:id/notes adds note
   - [ ] PUT /api/prospects/:id/notes/:idx edits note
   - [ ] DELETE /api/prospects/:id/notes/:idx removes note

4. **AI Templates Endpoint**
   - [ ] GET /api/ai/templates returns all templates
   - [ ] POST /api/ai/templates creates template
   - [ ] PUT /api/ai/templates/:id updates template
   - [ ] POST /api/ai/templates/:id/duplicate duplicates

5. **AI Runs Endpoint**
   - [ ] POST /api/ai/runs creates run and returns immediately
   - [ ] GET /api/ai/runs/:id returns run with current status
   - [ ] Run processes in background (not blocking)
   - [ ] Status updates from queued → running → completed
   - [ ] processed_companies increments as companies are analyzed

6. **AI Results Endpoint**
   - [ ] GET /api/ai/runs/:id/results returns all results for run
   - [ ] POST /api/ai/results/:id/approve marks approved
   - [ ] POST /api/ai/results/:id/reject marks rejected
   - [ ] GET /api/ai/profiles/:orgnr returns aggregated profile

### Test with Curl

```bash
# Test companies endpoint
curl http://localhost:3000/api/companies | jq '. | length'

# Test single company
curl http://localhost:3000/api/companies/123456789 | jq '.'

# Test search
curl "http://localhost:3000/api/companies/search?q=acme" | jq '.'

# Test create list (with auth token)
curl -X POST http://localhost:3000/api/lists \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test List",
    "scope": "private",
    "stage": "research",
    "companyIds": ["123456789", "987654321"]
  }' | jq '.'

# Test create AI run
curl -X POST http://localhost:3000/api/ai/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Run",
    "list_id": "list_123",
    "template_id": "template_001",
    "config": {
      "model": "gpt-4",
      "temperature": 0.7,
      "max_tokens": 1500,
      "auto_approve": false
    }
  }' | jq '.'

# Poll run status
curl http://localhost:3000/api/ai/runs/run_abc123 | jq '.status'
```

---

## 💡 Tips for Smooth Migration

1. **Start with Read-Only**: Get all GET endpoints working first
2. **Add Loading States**: Show spinners while data loads
3. **Handle Errors**: Add error boundaries and toast notifications
4. **Use React Query**: Automatically handles caching, refetching, loading states
5. **Test Incrementally**: Don't replace everything at once
6. **Keep Mock Data**: Keep mockData.ts temporarily for fallback during development
7. **Add Logging**: Console.log API calls during development
8. **Check Network Tab**: Use browser DevTools to verify API calls
9. **Handle 401/403**: Redirect to login if unauthenticated
10. **Optimize Queries**: Use React Query's staleTime, cacheTime wisely

---

## 📞 Support

**Questions about API integration?**
- Check this document for endpoint mappings
- Verify your backend returns data in expected format
- Use browser DevTools Network tab to debug
- Check React Query DevTools for query state

**Backend team needs frontend specs?**
- Share the API Endpoint Mapping section (page 3-6)
- Share TypeScript types from Expected Backend Data Structures section

---

**Document prepared for Cursor AI integration**  
**All mock data locations documented and replacement strategy provided**  
**Ready for backend API connection**

---

## 🤖 Quick Cursor Prompts for Backend Integration

### Prompt 1: Review Mock Data Usage
```
Read /figma-export/BACKEND_INTEGRATION.md completely.
List all locations where mock data is currently used in /src/app/data/DataContext.tsx
and /src/app/pages/*.tsx files. Explain what needs to be replaced with real API calls.
```

### Prompt 2: Create API Service Layer
```
Read /figma-export/BACKEND_INTEGRATION.md section "Option 1: Create API Service Layer".
Create /src/app/services/api.ts with all API methods documented.
Use the exact endpoint structure and TypeScript types provided.
```

### Prompt 3: Setup React Query
```
Read /figma-export/BACKEND_INTEGRATION.md section "Option 2: Replace DataContext with React Query".
Install @tanstack/react-query.
Create /src/app/hooks/queries.ts with all custom hooks shown in the guide.
Setup QueryClientProvider in App.tsx.
```

### Prompt 4: Update Single Page
```
Read /figma-export/BACKEND_INTEGRATION.md section "Page-Level Changes Required".
Update /src/app/pages/[PageName].tsx to use React Query hooks instead of useData().
Replace all mock data calls with real API calls via custom hooks.
```

### Prompt 5: Update All Pages
```
Read /figma-export/BACKEND_INTEGRATION.md sections "Page-Level Changes Required" 
and "Complete Replacement Strategy".
Update ALL pages in /src/app/pages/ to replace useData() with React Query hooks.
Follow the exact patterns shown in the guide for each page.
```

### Prompt 6: Test API Integration
```
Read /figma-export/BACKEND_INTEGRATION.md section "Testing Your Backend Integration".
Create test file /src/tests/api.test.ts that verifies all API endpoints
match the expected structure and return correct data types.
```

### Prompt 7: Handle Authentication
```
Read /figma-export/BACKEND_INTEGRATION.md section "Authentication Considerations".
Implement authentication token management in /src/app/services/api.ts.
Add login/logout functions and protect all routes with auth check.
```

### Prompt 8: Environment Configuration
```
Create /src/app/config/env.ts to manage API base URL and other environment variables.
Update /src/app/services/api.ts to use this configuration.
Add .env.example file with all required environment variables documented.
```

---

## 📝 Summary Checklist for Backend Team

Share this checklist with your backend team:

### Required API Endpoints (35 total)

**Companies (3 endpoints):**
- [ ] GET /api/companies - Return all 13,421 companies
- [ ] GET /api/companies/:orgnr - Return single company by orgnr
- [ ] GET /api/companies/search?q={query} - Return search results

**Lists (5 endpoints):**
- [ ] GET /api/lists - Return user's lists
- [ ] GET /api/lists/:listId - Return single list
- [ ] POST /api/lists - Create new list
- [ ] PUT /api/lists/:listId - Update list
- [ ] DELETE /api/lists/:listId - Delete list

**Prospects (7 endpoints):**
- [ ] GET /api/prospects - Return all prospects
- [ ] POST /api/prospects - Create prospect
- [ ] PATCH /api/prospects/:id - Update prospect status
- [ ] POST /api/prospects/:id/notes - Add note
- [ ] PUT /api/prospects/:id/notes/:idx - Edit note
- [ ] DELETE /api/prospects/:id/notes/:idx - Delete note
- [ ] GET /api/prospects/:id - Get single prospect (optional but recommended)

**AI Templates (5 endpoints):**
- [ ] GET /api/ai/templates - Return all templates
- [ ] GET /api/ai/templates/:id - Return single template
- [ ] POST /api/ai/templates - Create template
- [ ] PUT /api/ai/templates/:id - Update template
- [ ] POST /api/ai/templates/:id/duplicate - Duplicate template

**AI Runs (4 endpoints):**
- [ ] GET /api/ai/runs - Return all runs
- [ ] GET /api/ai/runs/:id - Return single run (polled every 2s while running)
- [ ] POST /api/ai/runs - Create run (process async in background)
- [ ] POST /api/ai/runs/:id/cancel - Cancel running run

**AI Results (4 endpoints):**
- [ ] GET /api/ai/runs/:id/results - Return all results for run
- [ ] POST /api/ai/results/:id/approve - Approve result
- [ ] POST /api/ai/results/:id/reject - Reject result
- [ ] GET /api/ai/profiles/:orgnr - Return AI profile for company

### Data Format Requirements

All timestamps: ISO 8601 format (`2026-02-17T10:30:00Z`)  
All IDs: String type (e.g., `"list_abc123"`, `"run_xyz789"`)  
Company IDs: Use `orgnr` field (9-digit Swedish org number)  
Money values: Numbers in SEK (no currency symbol in API)  
Percentages: Decimals (0.35 = 35%)  

### CORS Configuration

Ensure your backend allows:
```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

### Authentication

If using JWT:
- Token in Authorization header: `Bearer <token>`
- Return token + user object on POST /api/auth/login
- Verify token on all protected endpoints
- Return 401 if token invalid/expired

---

**End of Backend Integration Guide**

