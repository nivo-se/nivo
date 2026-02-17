import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { 
  Users, 
  Key, 
  Database, 
  Activity, 
  Settings2, 
  Download,
  Upload,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  BarChart3,
  List,
  Target,
  Cpu
} from 'lucide-react';
import { useData } from '../data/DataContext';
import { toast } from 'sonner';

// Mock data for admin features
const teamMembers = [
  {
    id: 'user_001',
    name: 'Sarah',
    email: 'sarah@nivogroup.com',
    role: 'Admin',
    status: 'active',
    lastActive: '2 minutes ago',
    listsCreated: 12,
    prospectsAdded: 34,
    aiRunsCreated: 8
  },
  {
    id: 'user_002',
    name: 'Mike',
    email: 'mike@nivogroup.com',
    role: 'Member',
    status: 'active',
    lastActive: '1 hour ago',
    listsCreated: 8,
    prospectsAdded: 21,
    aiRunsCreated: 5
  },
  {
    id: 'user_003',
    name: 'Alex',
    email: 'alex@nivogroup.com',
    role: 'Member',
    status: 'active',
    lastActive: '3 hours ago',
    listsCreated: 5,
    prospectsAdded: 15,
    aiRunsCreated: 3
  }
];

const auditLog = [
  { id: 1, user: 'Sarah', action: 'Created AI run', details: '"Q1 Manufacturing Analysis"', timestamp: '2 minutes ago', type: 'ai_run' },
  { id: 2, user: 'Mike', action: 'Updated prospect status', details: 'Company #987654321 to "contacted"', timestamp: '1 hour ago', type: 'prospect' },
  { id: 3, user: 'Sarah', action: 'Created list', details: '"High Growth Tech"', timestamp: '3 hours ago', type: 'list' },
  { id: 4, user: 'Alex', action: 'Added companies to prospects', details: '5 companies', timestamp: '5 hours ago', type: 'prospect' },
  { id: 5, user: 'Sarah', action: 'Updated API key', details: 'OpenAI API key configured', timestamp: '1 day ago', type: 'settings' },
  { id: 6, user: 'Mike', action: 'Approved AI results', details: '12 companies approved', timestamp: '1 day ago', type: 'ai_run' },
  { id: 7, user: 'Alex', action: 'Exported data', details: 'List "SaaS Prospects" exported to CSV', timestamp: '2 days ago', type: 'export' },
  { id: 8, user: 'Sarah', action: 'Updated list', details: 'Modified filters for "Q1 Manufacturing Targets"', timestamp: '3 days ago', type: 'list' },
];

export default function Admin() {
  const { lists, prospects, aiRuns, companies } = useData();
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('sk-proj-abc...xyz123');
  const [autoApprove, setAutoApprove] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleSaveApiKey = () => {
    toast.success('API key saved successfully');
  };

  const handleExportData = (dataType: string) => {
    toast.success(`${dataType} data exported successfully`);
  };

  const handleImportData = () => {
    toast.success('Data import completed');
  };

  // Calculate statistics
  const totalLists = lists.length;
  const totalProspects = prospects.length;
  const totalAIRuns = aiRuns.length;
  const companiesInUniverse = companies.length;
  const activeProspects = prospects.filter(p => p.status === 'in_discussion' || p.status === 'contacted').length;
  const completedRuns = aiRuns.filter(r => r.status === 'completed').length;

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Admin Panel</h1>
          <p className="text-sm text-gray-600">System configuration and team management</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="api">API Configuration</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* System Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Lists</CardTitle>
                  <List className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalLists}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    Across all team members
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Prospects</CardTitle>
                  <Target className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeProspects}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    Out of {totalProspects} total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">AI Runs</CardTitle>
                  <Cpu className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{completedRuns}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {totalAIRuns} total runs
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Universe Size</CardTitle>
                  <Database className="h-4 w-4 text-gray-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{companiesInUniverse.toLocaleString()}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    Companies available
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Team Activity Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Team Activity Summary
                </CardTitle>
                <CardDescription>Overview of team member contributions</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team Member</TableHead>
                      <TableHead className="text-right">Lists Created</TableHead>
                      <TableHead className="text-right">Prospects Added</TableHead>
                      <TableHead className="text-right">AI Runs</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{member.name}</div>
                            <div className="text-sm text-gray-500">{member.email}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{member.listsCreated}</TableCell>
                        <TableCell className="text-right">{member.prospectsAdded}</TableCell>
                        <TableCell className="text-right">{member.aiRunsCreated}</TableCell>
                        <TableCell>
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            {member.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common administrative tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" className="justify-start" onClick={() => handleExportData('All')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export All Data
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={handleImportData}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Data
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => handleExportData('Lists')}>
                    <Database className="h-4 w-4 mr-2" />
                    Backup Lists
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => handleExportData('Prospects')}>
                    <Target className="h-4 w-4 mr-2" />
                    Export Prospects
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Members
                </CardTitle>
                <CardDescription>Manage your team and permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.name}</TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          <Badge variant={member.role === 'Admin' ? 'default' : 'secondary'}>
                            {member.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{member.lastActive}</TableCell>
                        <TableCell>
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {member.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">Edit</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-6">
                  <Button>
                    <Users className="h-4 w-4 mr-2" />
                    Invite Team Member
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Permissions Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Role Permissions</CardTitle>
                <CardDescription>Overview of what each role can do</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Admin</h4>
                    <ul className="text-sm text-gray-600 space-y-1 ml-4">
                      <li>• Full access to all features</li>
                      <li>• Can manage team members and roles</li>
                      <li>• Can configure API keys and system settings</li>
                      <li>• Can view audit logs and system statistics</li>
                      <li>• Can create and manage shared workspaces</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Member</h4>
                    <ul className="text-sm text-gray-600 space-y-1 ml-4">
                      <li>• Can create and manage personal lists</li>
                      <li>• Can access shared team lists</li>
                      <li>• Can add and manage prospects</li>
                      <li>• Can run AI analysis</li>
                      <li>• Cannot manage team or system settings</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Configuration Tab */}
          <TabsContent value="api" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  OpenAI API Configuration
                </CardTitle>
                <CardDescription>
                  Configure your OpenAI API key for AI analysis features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="api-key"
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-proj-..."
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button onClick={handleSaveApiKey}>Save</Button>
                  </div>
                  <p className="text-sm text-gray-500">
                    Get your API key from{' '}
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      OpenAI Platform
                    </a>
                  </p>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium mb-4">API Status</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <div className="font-medium">API Key Configured</div>
                        <div className="text-sm text-gray-500">Last validated 2 hours ago</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <div className="font-medium">Connection Active</div>
                        <div className="text-sm text-gray-500">Model: gpt-4o</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium mb-4">Usage Statistics</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">This Month</div>
                      <div className="text-2xl font-bold">$247.50</div>
                      <div className="text-sm text-gray-500">1,238 API calls</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Last Month</div>
                      <div className="text-2xl font-bold">$189.30</div>
                      <div className="text-sm text-gray-500">946 API calls</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Average Cost/Company</div>
                      <div className="text-2xl font-bold">$0.18</div>
                      <div className="text-sm text-green-600 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        12% more efficient
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rate Limits */}
            <Card>
              <CardHeader>
                <CardTitle>Rate Limits & Quotas</CardTitle>
                <CardDescription>Current API usage limits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Requests per minute</span>
                      <span className="text-gray-500">3,500 / 5,000</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: '70%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Tokens per minute</span>
                      <span className="text-gray-500">80,000 / 200,000</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: '40%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Monthly budget</span>
                      <span className="text-gray-500">$247.50 / $500.00</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-600" style={{ width: '49.5%' }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  System Settings
                </CardTitle>
                <CardDescription>Configure system preferences and defaults</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-approve">Auto-approve AI results</Label>
                    <p className="text-sm text-gray-500">
                      Automatically approve AI analysis results above threshold score
                    </p>
                  </div>
                  <Switch
                    id="auto-approve"
                    checked={autoApprove}
                    onCheckedChange={setAutoApprove}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifications">Email notifications</Label>
                    <p className="text-sm text-gray-500">
                      Receive email updates for AI run completions and mentions
                    </p>
                  </div>
                  <Switch
                    id="notifications"
                    checked={notificationsEnabled}
                    onCheckedChange={setNotificationsEnabled}
                  />
                </div>

                <div className="border-t pt-6 space-y-4">
                  <div>
                    <Label htmlFor="auto-approve-threshold">Auto-approve threshold score</Label>
                    <Input
                      id="auto-approve-threshold"
                      type="number"
                      defaultValue="80"
                      min="0"
                      max="100"
                      className="mt-2 max-w-xs"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      AI scores above this threshold will be automatically approved
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="default-model">Default AI Model</Label>
                    <select
                      id="default-model"
                      className="mt-2 flex h-10 w-full max-w-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="gpt-4o">GPT-4o (Recommended)</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    </select>
                    <p className="text-sm text-gray-500 mt-1">
                      Model used for AI analysis runs
                    </p>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <Button>Save Settings</Button>
                </div>
              </CardContent>
            </Card>

            {/* Data Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Data Management
                </CardTitle>
                <CardDescription>Export, import, and backup your data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" onClick={() => handleExportData('Companies')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Companies (CSV)
                  </Button>
                  <Button variant="outline" onClick={() => handleExportData('Lists')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Lists (JSON)
                  </Button>
                  <Button variant="outline" onClick={() => handleExportData('Prospects')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Prospects (CSV)
                  </Button>
                  <Button variant="outline" onClick={() => handleExportData('AI Results')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export AI Results (JSON)
                  </Button>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium mb-3">Import Data</h4>
                  <div className="space-y-3">
                    <Button variant="outline" onClick={handleImportData}>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Companies
                    </Button>
                    <p className="text-sm text-gray-500">
                      Upload CSV file with company data. Must match required schema.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Audit Log
                </CardTitle>
                <CardDescription>Track all important system activities and changes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {auditLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0"
                    >
                      <div className="mt-1">
                        {entry.type === 'ai_run' && <Cpu className="h-4 w-4 text-purple-600" />}
                        {entry.type === 'list' && <List className="h-4 w-4 text-blue-600" />}
                        {entry.type === 'prospect' && <Target className="h-4 w-4 text-green-600" />}
                        {entry.type === 'settings' && <Settings2 className="h-4 w-4 text-orange-600" />}
                        {entry.type === 'export' && <Download className="h-4 w-4 text-gray-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium">
                              <span className="text-gray-900">{entry.user}</span>
                              <span className="text-gray-600"> {entry.action}</span>
                            </p>
                            <p className="text-sm text-gray-500 mt-0.5">{entry.details}</p>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {entry.timestamp}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t">
                  <Button variant="outline" className="w-full">
                    Load More
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Audit Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Audit Settings</CardTitle>
                <CardDescription>Configure what actions are logged</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="log-list-changes">Log list changes</Label>
                    <Switch id="log-list-changes" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="log-prospect-changes">Log prospect changes</Label>
                    <Switch id="log-prospect-changes" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="log-ai-runs">Log AI runs</Label>
                    <Switch id="log-ai-runs" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="log-exports">Log data exports</Label>
                    <Switch id="log-exports" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="log-settings">Log settings changes</Label>
                    <Switch id="log-settings" defaultChecked />
                  </div>
                </div>

                <div className="border-t pt-4 mt-6">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-gray-500 mt-0.5" />
                    <p className="text-sm text-gray-600">
                      Audit logs are retained for 90 days. Export logs regularly for long-term archival.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}