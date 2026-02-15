import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { Save, RotateCcw, Settings, TrendingUp, Building2, Users } from 'lucide-react'
import { businessRulesEngine, BusinessRules, DEFAULT_BUSINESS_RULES } from '../lib/businessRules'

const BusinessRulesConfig: React.FC = () => {
  const [rules, setRules] = useState<BusinessRules>(DEFAULT_BUSINESS_RULES)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    // Load current rules
    setRules(businessRulesEngine.getRules())
  }, [])

  const updateRule = (category: keyof BusinessRules, subcategory: string, field: string, value: number) => {
    setRules(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [subcategory]: {
          ...(prev[category] as any)[subcategory],
          [field]: value
        }
      }
    }))
    setHasChanges(true)
  }

  const saveRules = () => {
    businessRulesEngine.updateRules(rules)
    setHasChanges(false)
    // TODO: Save to backend/localStorage for persistence
    console.log('Business rules updated:', rules)
  }

  const resetRules = () => {
    setRules(DEFAULT_BUSINESS_RULES)
    setHasChanges(true)
  }

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`
  const formatRevenue = (value: number) => `${(value / 1000000).toFixed(1)}M SEK`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Business Rules Configuration
          </h2>
          <p className="text-gray-600">Define thresholds for categorizing companies</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetRules}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={saveRules} disabled={!hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 font-medium">You have unsaved changes</p>
          <p className="text-yellow-700 text-sm">Click "Save Changes" to apply your modifications</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profitability Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Profitability Categories
            </CardTitle>
            <CardDescription>Based on EBIT Margin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="high-profit-min">High Profitability (≥)</Label>
                <Input
                  id="high-profit-min"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={rules.profitability.high.min}
                  onChange={(e) => updateRule('profitability', 'high', 'min', parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-gray-500 mt-1">{formatPercentage(rules.profitability.high.min)}</p>
              </div>
              <div>
                <Label htmlFor="good-profit-min">Good Profitability (≥)</Label>
                <Input
                  id="good-profit-min"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={rules.profitability.good.min}
                  onChange={(e) => updateRule('profitability', 'good', 'min', parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-gray-500 mt-1">{formatPercentage(rules.profitability.good.min)}</p>
              </div>
              <div>
                <Label htmlFor="low-profit-min">Low Profitability (≥)</Label>
                <Input
                  id="low-profit-min"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={rules.profitability.low.min}
                  onChange={(e) => updateRule('profitability', 'low', 'min', parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-gray-500 mt-1">{formatPercentage(rules.profitability.low.min)}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <h4 className="font-medium">Current Categories:</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">High: ≥ {formatPercentage(rules.profitability.high.min)}</Badge>
                <Badge variant="secondary">Good: ≥ {formatPercentage(rules.profitability.good.min)}</Badge>
                <Badge variant="outline">Low: ≥ {formatPercentage(rules.profitability.low.min)}</Badge>
                <Badge variant="destructive">Loss: &lt; {formatPercentage(rules.profitability.low.min)}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Growth Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Growth Categories
            </CardTitle>
            <CardDescription>Based on Revenue Growth Rate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="high-growth-min">High Growth (≥)</Label>
                <Input
                  id="high-growth-min"
                  type="number"
                  step="0.01"
                  value={rules.growth.high.min}
                  onChange={(e) => updateRule('growth', 'high', 'min', parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-gray-500 mt-1">{formatPercentage(rules.growth.high.min)}</p>
              </div>
              <div>
                <Label htmlFor="medium-growth-min">Medium Growth (≥)</Label>
                <Input
                  id="medium-growth-min"
                  type="number"
                  step="0.01"
                  value={rules.growth.medium.min}
                  onChange={(e) => updateRule('growth', 'medium', 'min', parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-gray-500 mt-1">{formatPercentage(rules.growth.medium.min)}</p>
              </div>
              <div>
                <Label htmlFor="low-growth-min">Low Growth (≥)</Label>
                <Input
                  id="low-growth-min"
                  type="number"
                  step="0.01"
                  value={rules.growth.low.min}
                  onChange={(e) => updateRule('growth', 'low', 'min', parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-gray-500 mt-1">{formatPercentage(rules.growth.low.min)}</p>
              </div>
              <div>
                <Label htmlFor="declining-min">Declining (≥)</Label>
                <Input
                  id="declining-min"
                  type="number"
                  step="0.01"
                  value={rules.growth.declining.min}
                  onChange={(e) => updateRule('growth', 'declining', 'min', parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-gray-500 mt-1">{formatPercentage(rules.growth.declining.min)}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <h4 className="font-medium">Current Categories:</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">High: ≥ {formatPercentage(rules.growth.high.min)}</Badge>
                <Badge variant="secondary">Medium: ≥ {formatPercentage(rules.growth.medium.min)}</Badge>
                <Badge variant="outline">Low: ≥ {formatPercentage(rules.growth.low.min)}</Badge>
                <Badge variant="destructive">Decline: &lt; {formatPercentage(rules.growth.low.min)}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Size Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Size Categories
            </CardTitle>
            <CardDescription>Based on Revenue and Employee Count</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="micro-max-revenue">Micro Max Revenue (SEK)</Label>
                  <Input
                    id="micro-max-revenue"
                    type="number"
                    step="100000"
                    value={rules.companySize.micro.maxRevenue}
                    onChange={(e) => updateRule('companySize', 'micro', 'maxRevenue', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-gray-500 mt-1">{formatRevenue(rules.companySize.micro.maxRevenue)}</p>
                </div>
                <div>
                  <Label htmlFor="micro-max-employees">Micro Max Employees</Label>
                  <Input
                    id="micro-max-employees"
                    type="number"
                    min="1"
                    value={rules.companySize.micro.maxEmployees}
                    onChange={(e) => updateRule('companySize', 'micro', 'maxEmployees', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="small-max-revenue">Small Max Revenue (SEK)</Label>
                  <Input
                    id="small-max-revenue"
                    type="number"
                    step="100000"
                    value={rules.companySize.small.maxRevenue}
                    onChange={(e) => updateRule('companySize', 'small', 'maxRevenue', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-gray-500 mt-1">{formatRevenue(rules.companySize.small.maxRevenue)}</p>
                </div>
                <div>
                  <Label htmlFor="small-max-employees">Small Max Employees</Label>
                  <Input
                    id="small-max-employees"
                    type="number"
                    min="1"
                    value={rules.companySize.small.maxEmployees}
                    onChange={(e) => updateRule('companySize', 'small', 'maxEmployees', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <h4 className="font-medium">Current Categories:</h4>
              <div className="space-y-1 text-sm">
                <div><Badge variant="outline">Micro:</Badge> Revenue &lt; {formatRevenue(rules.companySize.micro.maxRevenue)}, Employees ≤ {rules.companySize.micro.maxEmployees}</div>
                <div><Badge variant="secondary">Small:</Badge> Revenue {formatRevenue(rules.companySize.micro.maxRevenue)}-{formatRevenue(rules.companySize.small.maxRevenue)}, Employees {rules.companySize.micro.maxEmployees + 1}-{rules.companySize.small.maxEmployees}</div>
                <div><Badge variant="default">Medium:</Badge> Revenue {formatRevenue(rules.companySize.small.maxRevenue)}-{formatRevenue(rules.companySize.medium.maxRevenue)}, Employees {rules.companySize.small.maxEmployees + 1}-{rules.companySize.medium.maxEmployees}</div>
                <div><Badge variant="destructive">Large:</Badge> Revenue &gt; {formatRevenue(rules.companySize.large.minRevenue)}, Employees &gt; {rules.companySize.large.minEmployees}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employee Size Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employee Size Categories
            </CardTitle>
            <CardDescription>Based on Employee Count</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="micro-max-emp">Micro Max Employees</Label>
                <Input
                  id="micro-max-emp"
                  type="number"
                  min="1"
                  value={rules.employeeSize.micro.max}
                  onChange={(e) => updateRule('employeeSize', 'micro', 'max', parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label htmlFor="small-max-emp">Small Max Employees</Label>
                <Input
                  id="small-max-emp"
                  type="number"
                  min="1"
                  value={rules.employeeSize.small.max}
                  onChange={(e) => updateRule('employeeSize', 'small', 'max', parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label htmlFor="medium-max-emp">Medium Max Employees</Label>
                <Input
                  id="medium-max-emp"
                  type="number"
                  min="1"
                  value={rules.employeeSize.medium.max}
                  onChange={(e) => updateRule('employeeSize', 'medium', 'max', parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label htmlFor="large-max-emp">Large Max Employees</Label>
                <Input
                  id="large-max-emp"
                  type="number"
                  min="1"
                  value={rules.employeeSize.large.max}
                  onChange={(e) => updateRule('employeeSize', 'large', 'max', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <h4 className="font-medium">Current Categories:</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Micro: 1-{rules.employeeSize.micro.max}</Badge>
                <Badge variant="secondary">Small: {rules.employeeSize.micro.max + 1}-{rules.employeeSize.small.max}</Badge>
                <Badge variant="default">Medium: {rules.employeeSize.small.max + 1}-{rules.employeeSize.medium.max}</Badge>
                <Badge variant="destructive">Large: {rules.employeeSize.medium.max + 1}-{rules.employeeSize.large.max}</Badge>
                <Badge variant="default">Enterprise: {rules.employeeSize.enterprise.min}+</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Section */}
      <Card>
        <CardHeader>
          <CardTitle>Rules Preview</CardTitle>
          <CardDescription>How the current rules will categorize companies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-medium mb-2">Profitability Examples:</h4>
              <div className="space-y-1 text-sm">
                <div>EBIT Margin 20% → <Badge variant="default">High Profitability</Badge></div>
                <div>EBIT Margin 8% → <Badge variant="secondary">Good Profitability</Badge></div>
                <div>EBIT Margin 2% → <Badge variant="outline">Low Profitability</Badge></div>
                <div>EBIT Margin -5% → <Badge variant="destructive">Loss Making</Badge></div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Growth Examples:</h4>
              <div className="space-y-1 text-sm">
                <div>Growth 25% → <Badge variant="default">High Growth</Badge></div>
                <div>Growth 8% → <Badge variant="secondary">Medium Growth</Badge></div>
                <div>Growth 2% → <Badge variant="outline">Low Growth</Badge></div>
                <div>Growth -15% → <Badge variant="destructive">Rapid Decline</Badge></div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Size Examples:</h4>
              <div className="space-y-1 text-sm">
                <div>5 employees → <Badge variant="outline">Micro</Badge></div>
                <div>25 employees → <Badge variant="secondary">Small</Badge></div>
                <div>100 employees → <Badge variant="default">Medium</Badge></div>
                <div>500 employees → <Badge variant="destructive">Enterprise</Badge></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default BusinessRulesConfig










