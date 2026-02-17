import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useData } from '../data/DataContext';
import { calculateRevenueCagr, getLatestFinancials } from '../data/mockData';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { FilterBuilder } from '../components/FilterBuilder';
import { ArrowLeft, RefreshCw, Brain, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function ListDetail() {
  const { listId } = useParams();
  const navigate = useNavigate();
  const { getList, updateList, companies, getCompany, addToProspects } = useData();
  const list = getList(listId!);
  
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [editedFilters, setEditedFilters] = useState(list?.filters);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());

  if (!list) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">List not found</h2>
          <Link to="/lists">
            <Button>Back to Lists</Button>
          </Link>
        </div>
      </div>
    );
  }

  const listCompanies = list.companyIds
    .map(id => getCompany(id))
    .filter(Boolean);

  const handleReloadFilters = () => {
    setShowFilterBuilder(true);
    setEditedFilters(list.filters);
  };

  const handleUpdateList = () => {
    if (!editedFilters) return;

    // Re-apply filters to get new company set
    let result = [...companies];

    if (editedFilters.include.rules.length > 0) {
      result = result.filter(company => evaluateFilterGroup(company, editedFilters.include));
    }

    if (editedFilters.exclude.rules.length > 0) {
      result = result.filter(company => !evaluateFilterGroup(company, editedFilters.exclude));
    }

    const newCompanyIds = result.map(c => c.id);

    updateList(list.id, {
      companyIds: newCompanyIds,
      filters: editedFilters
    });

    setShowFilterBuilder(false);
    toast.success(`List updated with ${newCompanyIds.length} companies`);
  };

  const handleAddToProspects = () => {
    const companyIds = Array.from(selectedCompanies);
    addToProspects(companyIds);
    toast.success(`Added ${companyIds.length} companies to Prospects`);
    setSelectedCompanies(new Set());
  };

  const toggleSelectCompany = (companyId: string) => {
    const newSelection = new Set(selectedCompanies);
    if (newSelection.has(companyId)) {
      newSelection.delete(companyId);
    } else {
      newSelection.add(companyId);
    }
    setSelectedCompanies(newSelection);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link to="/lists">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{list.name}</h1>
                {list.scope === 'team' && (
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    Shareable
                  </span>
                )}
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                  {getStageLabel(list.stage)}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                {listCompanies.length} companies • Created by {list.created_by} • {new Date(list.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {list.filters && (
              <Button variant="outline" onClick={handleReloadFilters}>
                <RefreshCw className="w-4 h-4 mr-2" /> Reload & Modify Filters
              </Button>
            )}
            <Button variant="outline">
              <Brain className="w-4 h-4 mr-2" /> Run AI Analysis
            </Button>
            <Button
              disabled={selectedCompanies.size === 0}
              onClick={handleAddToProspects}
            >
              Add to Prospects ({selectedCompanies.size})
            </Button>
          </div>
        </div>

        {/* Filter Builder */}
        {showFilterBuilder && editedFilters && (
          <div className="mt-4">
            <FilterBuilder
              filters={editedFilters}
              onChange={setEditedFilters}
              onApply={handleUpdateList}
            />
            <div className="mt-3 flex gap-2">
              <Button onClick={handleUpdateList}>Update List</Button>
              <Button variant="outline" onClick={() => setShowFilterBuilder(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {list.filters && !showFilterBuilder && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
            <p className="text-blue-900">
              ✓ This list was created from filters and can be reloaded to see updated results
            </p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 py-4">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <Checkbox />
                </th>
                <th className="px-4 py-3 text-left">Company Name</th>
                <th className="px-4 py-3 text-left">Industry</th>
                <th className="px-4 py-3 text-left">Geography</th>
                <th className="px-4 py-3 text-right">Revenue (2025)</th>
                <th className="px-4 py-3 text-right">3Y CAGR</th>
                <th className="px-4 py-3 text-right">EBITDA Margin</th>
                <th className="px-4 py-3 text-center">AI Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {listCompanies.map(company => {
                if (!company) return null;
                
                const latestFinancials = getLatestFinancials(company);
                const cagr = calculateRevenueCagr(company);
                
                return (
                  <tr key={company.orgnr} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedCompanies.has(company.orgnr)}
                        onCheckedChange={() => toggleSelectCompany(company.orgnr)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link 
                        to={`/company/${company.orgnr}`}
                        className="font-medium text-blue-600 hover:text-blue-800 flex items-center gap-2"
                      >
                        {company.display_name}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{company.industry_label}</td>
                    <td className="px-4 py-3 text-gray-700">{company.region}</td>
                    <td className="px-4 py-3 text-right text-gray-900 font-mono">
                      {(latestFinancials.revenue / 1_000_000).toFixed(1)}M SEK
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={cagr > 0.15 ? 'text-green-600' : cagr < 0 ? 'text-red-600' : 'text-gray-700'}>
                        {(cagr * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-mono">
                      {(latestFinancials.ebitda_margin * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      {company.ai_profile?.ai_fit_score ? (
                        <span className={`font-semibold ${
                          company.ai_profile.ai_fit_score >= 75 ? 'text-green-600' :
                          company.ai_profile.ai_fit_score >= 50 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {company.ai_profile.ai_fit_score}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Helper functions (same as Universe page)
function evaluateFilterGroup(company: any, group: any): boolean {
  if (!group.rules || group.rules.length === 0) return true;

  const results = group.rules.map((rule: any) => {
    if ('type' in rule) {
      return evaluateFilterGroup(company, rule);
    } else {
      return evaluateFilterRule(company, rule);
    }
  });

  return group.type === 'and' 
    ? results.every(r => r)
    : results.some(r => r);
}

function evaluateFilterRule(company: any, rule: any): boolean {
  const { field, operator, value } = rule;
  
  let companyValue: any;
  
  switch (field) {
    case 'revenue_2025':
      companyValue = getLatestFinancials(company).revenue;
      break;
    case 'ebitda_2025':
      companyValue = getLatestFinancials(company).ebitda;
      break;
    case 'ebitda_margin':
      companyValue = getLatestFinancials(company).ebitdaMargin;
      break;
    case 'revenue_cagr':
      companyValue = calculateRevenueCagr(company);
      break;
    case 'industry':
      companyValue = company.industry;
      break;
    case 'geography':
      companyValue = company.geography;
      break;
    case 'ownedByPE':
      companyValue = company.ownedByPE;
      break;
    case 'isSubsidiary':
      companyValue = company.isSubsidiary;
      break;
    case 'description':
      companyValue = company.description.toLowerCase();
      break;
    default:
      return true;
  }

  switch (operator) {
    case 'eq':
      return companyValue === value;
    case 'neq':
      return companyValue !== value;
    case 'gt':
      return companyValue > value;
    case 'gte':
      return companyValue >= value;
    case 'lt':
      return companyValue < value;
    case 'lte':
      return companyValue <= value;
    case 'contains':
      return typeof companyValue === 'string' && companyValue.includes(value.toLowerCase());
    default:
      return true;
  }
}

// Helper function to get stage label
function getStageLabel(stage: string): string {
  switch (stage) {
    case 'draft':
      return 'Draft';
    case 'active':
      return 'Active';
    case 'archived':
      return 'Archived';
    default:
      return 'Unknown';
  }
}