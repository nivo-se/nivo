import { useParams, Link } from 'react-router';
import { useData } from '../data/DataContext';
import { calculateRevenueCagr, getLatestFinancials } from '../data/mockData';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, TrendingUp, Users, MapPin, Building, Sparkles, AlertTriangle, CheckCircle } from 'lucide-react';

export default function CompanyDetail() {
  const { companyId } = useParams();
  const { getCompany, getCompanyAIProfile } = useData();
  const company = getCompany(companyId!);
  const aiProfile = company ? getCompanyAIProfile(company.orgnr) : null;

  if (!company) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Company not found</h2>
          <Link to="/universe">
            <Button>Back to Universe</Button>
          </Link>
        </div>
      </div>
    );
  }

  const latestFinancials = getLatestFinancials(company);
  const cagr = calculateRevenueCagr(company);

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-6">
          <Link to="/universe">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Universe
            </Button>
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{company.display_name}</h1>
              <div className="flex items-center gap-4 text-gray-600">
                <div className="flex items-center gap-1">
                  <Building className="w-4 h-4" />
                  {company.industry_label}
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {company.region}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  ~{company.employees_latest} employees
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Add to List</Button>
              <Button>Run AI Analysis</Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
            <TabsTrigger value="ai">AI Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Revenue (2025)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-gray-900">
                    ${latestFinancials.revenue.toFixed(1)}M
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">3Y CAGR</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${cagr > 15 ? 'text-green-600' : 'text-gray-900'}`}>
                    {cagr.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">EBITDA Margin</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-gray-900">
                    {latestFinancials.ebitdaMargin.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">EBITDA (2025)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-gray-900">
                    ${latestFinancials.ebitda.toFixed(1)}M
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Company Info */}
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Description</p>
                    <p className="text-gray-900">{company.description}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Ownership</p>
                    <div className="space-y-1">
                      {company.ownedByPE && (
                        <span className="inline-block px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                          PE-Backed
                        </span>
                      )}
                      {company.isSubsidiary && (
                        <span className="inline-block px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded ml-2">
                          Subsidiary
                        </span>
                      )}
                      {!company.ownedByPE && !company.isSubsidiary && (
                        <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                          Independent
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financials" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>4-Year Financial History</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Year</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Revenue ($M)</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">EBITDA ($M)</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Gross Margin</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">EBITDA Margin</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">YoY Growth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {company.financials.map((financial, index) => {
                      const yoyGrowth = index > 0
                        ? ((financial.revenue - company.financials[index - 1].revenue) / company.financials[index - 1].revenue) * 100
                        : null;

                      return (
                        <tr key={financial.year} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{financial.year}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-900">
                            ${financial.revenue.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-900">
                            ${financial.ebitda.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-900">
                            {financial.grossMargin.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-900">
                            {financial.ebitdaMargin.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {yoyGrowth !== null ? (
                              <span className={yoyGrowth > 0 ? 'text-green-600' : 'text-red-600'}>
                                {yoyGrowth > 0 ? '+' : ''}{yoyGrowth.toFixed(1)}%
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="mt-6">
            {aiProfile && aiProfile.latest_result ? (
              <div className="space-y-6">
                {/* Overall Score */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-blue-600" />
                        AI Investment Score
                      </span>
                      <div className="text-right">
                        <span className={`text-4xl font-bold ${
                          aiProfile.ai_fit_score >= 75 ? 'text-green-600' :
                          aiProfile.ai_fit_score >= 50 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {aiProfile.ai_fit_score}
                        </span>
                        <p className="text-sm text-gray-600 mt-1">
                          {aiProfile.latest_result.recommendation === 'strong_fit' ? 'Strong Fit' :
                           aiProfile.latest_result.recommendation === 'potential_fit' ? 'Potential Fit' :
                           aiProfile.latest_result.recommendation === 'weak_fit' ? 'Weak Fit' : 'Pass'}
                        </p>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                      {aiProfile.latest_result.summary}
                    </p>
                    <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                      <span>Last analyzed: {new Date(aiProfile.last_analyzed).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{aiProfile.analysis_count} {aiProfile.analysis_count === 1 ? 'analysis' : 'analyses'} total</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Strengths & Concerns */}
                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="w-5 h-5" />
                        Key Strengths
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {aiProfile.latest_result.strengths.map((strength, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700">{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-red-700">
                        <AlertTriangle className="w-5 h-5" />
                        Concerns & Red Flags
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {aiProfile.latest_result.concerns.map((concern, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700">{concern}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No AI analysis available for this company yet</p>
                  <p className="text-sm text-gray-400 mb-6">Run an AI analysis to get investment insights, fit scores, and recommendations</p>
                  <Link to="/ai">
                    <Button>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Go to AI Lab
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}