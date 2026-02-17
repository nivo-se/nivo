import { useState, useMemo } from 'react';
import { useData } from '../data/DataContext';
import { Company, calculateRevenueCagr, getLatestFinancials } from '../data/mockData';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { FilterBuilder } from '../components/FilterBuilder';
import { SaveListDialog } from '../components/SaveListDialog';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function Universe() {
  const { companies, createList } = useData();
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const companiesPerPage = 50;

  // Filter state
  const [activeFilters, setActiveFilters] = useState<any>({
    include: { type: 'and', rules: [] },
    exclude: { type: 'and', rules: [] }
  });

  // Apply filters
  const filteredCompanies = useMemo(() => {
    let result = [...companies];

    // Apply include filters
    if (activeFilters.include.rules.length > 0) {
      result = result.filter(company => {
        return evaluateFilterGroup(company, activeFilters.include);
      });
    }

    // Apply exclude filters
    if (activeFilters.exclude.rules.length > 0) {
      result = result.filter(company => {
        return !evaluateFilterGroup(company, activeFilters.exclude);
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case 'name':
          aVal = a.display_name;
          bVal = b.display_name;
          break;
        case 'industry':
          aVal = a.industry_label;
          bVal = b.industry_label;
          break;
        case 'geography':
          aVal = a.region || '';
          bVal = b.region || '';
          break;
        case 'revenue':
          aVal = a.revenue_latest;
          bVal = b.revenue_latest;
          break;
        case 'margin':
          aVal = a.ebitda_margin_latest;
          bVal = b.ebitda_margin_latest;
          break;
        case 'cagr':
          aVal = a.revenue_cagr_3y;
          bVal = b.revenue_cagr_3y;
          break;
        case 'employees':
          aVal = a.employees_latest;
          bVal = b.employees_latest;
          break;
        default:
          aVal = a.display_name;
          bVal = b.display_name;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      } else {
        return sortDirection === 'asc' 
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      }
    });

    return result;
  }, [companies, activeFilters, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredCompanies.length / companiesPerPage);
  const paginatedCompanies = filteredCompanies.slice(
    (currentPage - 1) * companiesPerPage,
    currentPage * companiesPerPage
  );

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
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

  const toggleSelectAll = () => {
    if (selectedCompanies.size === paginatedCompanies.length) {
      setSelectedCompanies(new Set());
    } else {
      setSelectedCompanies(new Set(paginatedCompanies.map(c => c.orgnr)));
    }
  };

  const handleSaveList = (name: string, isPublic: boolean) => {
    const companyIds = Array.from(selectedCompanies);
    const filters = activeFilters.include.rules.length > 0 || activeFilters.exclude.rules.length > 0
      ? activeFilters
      : undefined;
    
    const list = createList(name, filters, companyIds, isPublic);
    setShowSaveDialog(false);
    navigate(`/lists/${list.id}`);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Universe</h1>
            <p className="text-sm text-gray-600 mt-1">
              Showing {filteredCompanies.length.toLocaleString()} of {companies.length.toLocaleString()} companies
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>
            <Button 
              variant="outline"
              disabled={selectedCompanies.size === 0}
              onClick={() => setShowSaveDialog(true)}
            >
              Save as List ({selectedCompanies.size})
            </Button>
            <Button variant="outline">Export</Button>
          </div>
        </div>

        {/* Filter Builder */}
        {showFilters && (
          <div className="mt-4">
            <FilterBuilder
              filters={activeFilters}
              onChange={setActiveFilters}
              onApply={() => setCurrentPage(1)}
            />
          </div>
        )}

        {/* Active Filters Summary */}
        {!showFilters && (activeFilters.include.rules.length > 0 || activeFilters.exclude.rules.length > 0) && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-gray-600">Active filters:</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
              {activeFilters.include.rules.length} include rules
            </span>
            {activeFilters.exclude.rules.length > 0 && (
              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">
                {activeFilters.exclude.rules.length} exclude rules
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(true)}>
              Edit Filters
            </Button>
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
                  <Checkbox
                    checked={selectedCompanies.size === paginatedCompanies.length && paginatedCompanies.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3 text-left">
                  <SortableHeader
                    label="Company Name"
                    field="name"
                    currentField={sortField}
                    direction={sortDirection}
                    onClick={toggleSort}
                  />
                </th>
                <th className="px-4 py-3 text-left">
                  <SortableHeader
                    label="Industry"
                    field="industry"
                    currentField={sortField}
                    direction={sortDirection}
                    onClick={toggleSort}
                  />
                </th>
                <th className="px-4 py-3 text-left">Geography</th>
                <th className="px-4 py-3 text-right">
                  <SortableHeader
                    label="Revenue (2025)"
                    field="revenue"
                    currentField={sortField}
                    direction={sortDirection}
                    onClick={toggleSort}
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortableHeader
                    label="3Y CAGR"
                    field="cagr"
                    currentField={sortField}
                    direction={sortDirection}
                    onClick={toggleSort}
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortableHeader
                    label="EBITDA Margin"
                    field="ebitda_margin"
                    currentField={sortField}
                    direction={sortDirection}
                    onClick={toggleSort}
                  />
                </th>
                <th className="px-4 py-3 text-center">Flags</th>
                <th className="px-4 py-3 text-center">AI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedCompanies.map(company => {
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
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {company.display_name}
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
                    <td className="px-4 py-3 text-center text-xs">
                      {company.status === 'inactive' && <span className="text-orange-600" title="Inactive">INA</span>}
                      {!company.has_3y_financials && <span className="text-orange-600" title="Incomplete financials"> INC</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {company.ai_profile ? (
                        <span className="text-green-600 font-semibold" title={`Score: ${company.ai_profile.ai_fit_score}`}>
                          ✓
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-600">
            Showing {((currentPage - 1) * companiesPerPage) + 1} to {Math.min(currentPage * companiesPerPage, filteredCompanies.length)} of {filteredCompanies.length}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            {totalPages > 5 && <span className="px-2 py-1">...</span>}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Save List Dialog */}
      {showSaveDialog && (
        <SaveListDialog
          open={showSaveDialog}
          onClose={() => setShowSaveDialog(false)}
          onSave={handleSaveList}
          companyCount={selectedCompanies.size}
        />
      )}
    </div>
  );
}

// Helper function to evaluate filter groups
function evaluateFilterGroup(company: Company, group: any): boolean {
  if (!group.rules || group.rules.length === 0) return true;

  const results = group.rules.map((rule: any) => {
    if ('type' in rule) {
      // It's a nested group
      return evaluateFilterGroup(company, rule);
    } else {
      // It's a rule
      return evaluateFilterRule(company, rule);
    }
  });

  return group.type === 'and' 
    ? results.every(r => r)
    : results.some(r => r);
}

function evaluateFilterRule(company: Company, rule: any): boolean {
  const { field, operator, value } = rule;
  
  let companyValue: any;
  
  // Get company value based on field
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

  // Apply operator
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

function SortableHeader({ 
  label, 
  field, 
  currentField, 
  direction, 
  onClick 
}: { 
  label: string;
  field: string;
  currentField: string;
  direction: 'asc' | 'desc';
  onClick: (field: string) => void;
}) {
  const isActive = currentField === field;
  
  return (
    <button
      className="flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900"
      onClick={() => onClick(field)}
    >
      {label}
      {isActive && (
        direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
      )}
    </button>
  );
}