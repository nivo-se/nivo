import { useState } from 'react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { X, Plus } from 'lucide-react';

interface FilterRule {
  id: string;
  field: string;
  operator: string;
  value: any;
}

interface FilterGroup {
  id: string;
  type: 'and' | 'or';
  rules: (FilterRule | FilterGroup)[];
}

interface Filters {
  include: FilterGroup;
  exclude: FilterGroup;
}

interface FilterBuilderProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onApply: () => void;
}

const filterFields = [
  { value: 'revenue_latest', label: 'Revenue (Latest)', type: 'number', unit: 'SEK' },
  { value: 'ebitda_latest', label: 'EBITDA (Latest)', type: 'number', unit: 'SEK' },
  { value: 'ebit_latest', label: 'EBIT (Latest)', type: 'number', unit: 'SEK' },
  { value: 'ebitda_margin_latest', label: 'EBITDA Margin', type: 'percent' },
  { value: 'ebit_margin_latest', label: 'EBIT Margin', type: 'percent' },
  { value: 'revenue_growth_yoy_latest', label: 'YoY Growth', type: 'percent' },
  { value: 'revenue_cagr_3y', label: 'Revenue CAGR (3Y)', type: 'percent' },
  { value: 'revenue_cagr_5y', label: 'Revenue CAGR (5Y)', type: 'percent' },
  { value: 'employees_latest', label: 'Employees', type: 'number' },
  { value: 'industry_label', label: 'Industry', type: 'select', options: ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Construction', 'Transportation', 'Energy', 'Telecommunications', 'Education'] },
  { value: 'region', label: 'Region', type: 'select', options: ['Stockholm', 'Gothenburg', 'Malmö', 'Uppsala', 'Västerås', 'Linköping', 'Örebro', 'Norrköping', 'Jönköping', 'Helsingborg'] },
  { value: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
  { value: 'has_homepage', label: 'Has Homepage', type: 'boolean' },
  { value: 'has_ai_profile', label: 'Has AI Profile', type: 'boolean' },
  { value: 'has_3y_financials', label: 'Has 3Y Financials', type: 'boolean' },
  { value: 'is_stale', label: 'Is Stale', type: 'boolean' },
  { value: 'data_quality_score', label: 'Data Quality Score (0-4)', type: 'number' },
  { value: 'stability_score', label: 'Stability Score', type: 'number' },
  { value: 'leverage_ratio', label: 'Leverage Ratio', type: 'number' },
  { value: 'display_name', label: 'Company Name Contains', type: 'text' },
];

const numberOperators = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'eq', label: '=' },
];

const percentOperators = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'eq', label: '=' },
];

const textOperators = [
  { value: 'contains', label: 'Contains' },
  { value: 'eq', label: 'Equals' },
];

const booleanOperators = [
  { value: 'eq', label: '=' },
];

export function FilterBuilder({ filters, onChange, onApply }: FilterBuilderProps) {
  const addRule = (groupType: 'include' | 'exclude') => {
    const newRule: FilterRule = {
      id: `rule_${Date.now()}`,
      field: 'revenue_latest',
      operator: 'gt',
      value: 5000000
    };

    const newFilters = { ...filters };
    newFilters[groupType].rules.push(newRule);
    onChange(newFilters);
  };

  const removeRule = (groupType: 'include' | 'exclude', ruleId: string) => {
    const newFilters = { ...filters };
    newFilters[groupType].rules = newFilters[groupType].rules.filter((r: any) => r.id !== ruleId);
    onChange(newFilters);
  };

  const updateRule = (groupType: 'include' | 'exclude', ruleId: string, updates: Partial<FilterRule>) => {
    const newFilters = { ...filters };
    const ruleIndex = newFilters[groupType].rules.findIndex((r: any) => r.id === ruleId);
    if (ruleIndex !== -1) {
      newFilters[groupType].rules[ruleIndex] = {
        ...newFilters[groupType].rules[ruleIndex] as FilterRule,
        ...updates
      };
      onChange(newFilters);
    }
  };

  const clearAllFilters = () => {
    onChange({
      include: { id: 'inc_root', type: 'and', rules: [] },
      exclude: { id: 'exc_root', type: 'and', rules: [] }
    });
  };

  const hasActiveFilters = filters.include.rules.length > 0 || filters.exclude.rules.length > 0;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Filter Builder</h3>
        <div className="flex gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              Clear All
            </Button>
          )}
          <Button size="sm" onClick={onApply}>
            Apply Filters
          </Button>
        </div>
      </div>

      {/* Include Filters */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-900">INCLUDE ALL of the following:</h4>
          <Button variant="outline" size="sm" onClick={() => addRule('include')}>
            <Plus className="w-4 h-4 mr-1" /> Add Rule
          </Button>
        </div>
        
        {filters.include.rules.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No filters applied</p>
        ) : (
          <div className="space-y-2">
            {filters.include.rules.map((rule: any) => (
              <FilterRuleRow
                key={rule.id}
                rule={rule}
                onUpdate={(updates) => updateRule('include', rule.id, updates)}
                onRemove={() => removeRule('include', rule.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Exclude Filters */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-900">EXCLUDE ANY of the following:</h4>
          <Button variant="outline" size="sm" onClick={() => addRule('exclude')}>
            <Plus className="w-4 h-4 mr-1" /> Add Rule
          </Button>
        </div>
        
        {filters.exclude.rules.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No exclusions</p>
        ) : (
          <div className="space-y-2">
            {filters.exclude.rules.map((rule: any) => (
              <FilterRuleRow
                key={rule.id}
                rule={rule}
                onUpdate={(updates) => updateRule('exclude', rule.id, updates)}
                onRemove={() => removeRule('exclude', rule.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterRuleRow({
  rule,
  onUpdate,
  onRemove
}: {
  rule: FilterRule;
  onUpdate: (updates: Partial<FilterRule>) => void;
  onRemove: () => void;
}) {
  const fieldConfig = filterFields.find(f => f.value === rule.field);
  const fieldType = fieldConfig?.type || 'number';

  const getOperators = () => {
    switch (fieldType) {
      case 'number':
        return numberOperators;
      case 'percent':
        return percentOperators;
      case 'text':
        return textOperators;
      case 'boolean':
        return booleanOperators;
      case 'select':
        return [{ value: 'eq', label: '=' }];
      default:
        return numberOperators;
    }
  };

  const operators = getOperators();

  return (
    <div className="flex items-center gap-2 bg-white p-3 rounded border border-gray-200">
      {/* Field Select */}
      <Select value={rule.field} onValueChange={(value) => onUpdate({ field: value })}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {filterFields.map(field => (
            <SelectItem key={field.value} value={field.value}>
              {field.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator Select */}
      <Select value={rule.operator} onValueChange={(value) => onUpdate({ operator: value })}>
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map(op => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value Input */}
      {fieldType === 'number' && (
        <Input
          type="number"
          value={rule.value}
          onChange={(e) => onUpdate({ value: parseFloat(e.target.value) || 0 })}
          className="w-32"
          placeholder="Value"
        />
      )}

      {fieldType === 'percent' && (
        <Input
          type="number"
          value={rule.value}
          onChange={(e) => onUpdate({ value: parseFloat(e.target.value) || 0 })}
          className="w-32"
          placeholder="Value"
        />
      )}

      {fieldType === 'text' && (
        <Input
          type="text"
          value={rule.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
          className="w-48"
          placeholder="Enter text"
        />
      )}

      {fieldType === 'boolean' && (
        <Select value={rule.value.toString()} onValueChange={(value) => onUpdate({ value: value === 'true' })}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      )}

      {fieldType === 'select' && fieldConfig?.options && (
        <Select value={rule.value} onValueChange={(value) => onUpdate({ value })}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fieldConfig.options.map(option => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="ml-auto"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}