'use client';

import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';

function api(path: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return base ? `${base}${path}` : path;
}

interface Report {
  _id: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  generatedAt: string;
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalIssuesReported: number;
    totalAssetsAffected: number;
    mostReportedAssets: Array<{
      assetId: string;
      assetName: string;
      assetTag: string;
      issueCount: number;
    }>;
    mostReportedLocations: Array<{
      locationId: string;
      locationName: string;
      issueCount: number;
    }>;
    issuesByCategory: Array<{
      category: string;
      count: number;
    }>;
    issuesByStatus: {
      open: number;
      in_progress: number;
      completed: number;
      cancelled: number;
    };
    topDepartmentIssues: Array<{
      departmentId: string;
      departmentName: string;
      issueCount: number;
    }>;
  };
  insights: {
    criticalAssets: Array<{
      assetId: string;
      assetName: string;
      issueCount: number;
      avgResolutionTime: number;
    }>;
    performanceMetrics: {
      avgResolutionTime: number;
      avgResponseTime: number;
      resolutionRate: number;
    };
    trends: {
      issuesVsPreviousPeriod: number;
      resolutionTimeVsPrevious: number;
      highRiskLocations: string[];
    };
  };
  status: string;
}

function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all');

  useEffect(() => {
    fetchReports();
  }, [filterType]);

  const fetchReports = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const typeParam = filterType === 'all' ? '' : `?type=${filterType}`;
      const res = await fetch(api(`/api/reports${typeParam}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setReports(data.reports || []);
      } else {
        setError(data.message || 'Failed to load reports');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (type: 'daily' | 'weekly' | 'monthly') => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setGenerating(type);
    setError('');

    try {
      const res = await fetch(api(`/api/reports/generate/${type}`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        await fetchReports();
        setSelectedReport(data.report);
      } else {
        setError(data.message || 'Failed to generate report');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setGenerating(null);
    }
  };

  const downloadReport = (report: Report) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    // Helper function to add text with automatic page break
    const addText = (text: string, fontSize: number = 10, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = margin;
      }
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(text, margin, yPosition);
      yPosition += fontSize / 2 + 2;
    };

    // Helper function to add a line
    const addLine = () => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = margin;
      }
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 5;
    };

    // Title
    addText(`${report.reportType.toUpperCase()} REPORT`, 20, true, [37, 99, 235]);
    yPosition += 5;
    addText(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, 10, false, [100, 100, 100]);
    addText(`Period: ${new Date(report.period.start).toLocaleDateString()} - ${new Date(report.period.end).toLocaleDateString()}`, 10, false, [100, 100, 100]);
    yPosition += 5;
    addLine();

    // Summary Section
    addText('SUMMARY', 16, true, [37, 99, 235]);
    yPosition += 3;
    addText(`Total Issues Reported: ${report.summary.totalIssuesReported}`, 11, true);
    addText(`Total Assets Affected: ${report.summary.totalAssetsAffected}`, 11, true);
    yPosition += 3;

    // Issues by Status
    addText('ISSUES BY STATUS:', 12, true);
    addText(`  Open: ${report.summary.issuesByStatus.open}`, 10);
    addText(`  In Progress: ${report.summary.issuesByStatus.in_progress}`, 10);
    addText(`  Completed: ${report.summary.issuesByStatus.completed}`, 10);
    addText(`  Cancelled: ${report.summary.issuesByStatus.cancelled}`, 10);
    yPosition += 5;
    addLine();

    // Most Reported Assets
    addText('MOST REPORTED ASSETS', 14, true, [37, 99, 235]);
    yPosition += 3;
    report.summary.mostReportedAssets.slice(0, 10).forEach((asset, i) => {
      addText(`${i + 1}. ${asset.assetName} (${asset.assetTag}) - ${asset.issueCount} issues`, 10);
    });
    yPosition += 5;
    addLine();

    // Most Reported Locations
    addText('MOST REPORTED LOCATIONS', 14, true, [37, 99, 235]);
    yPosition += 3;
    report.summary.mostReportedLocations.slice(0, 10).forEach((loc, i) => {
      addText(`${i + 1}. ${loc.locationName} - ${loc.issueCount} issues`, 10);
    });
    yPosition += 5;
    addLine();

    // Issues by Category
    if (report.summary.issuesByCategory.length > 0) {
      addText('ISSUES BY CATEGORY', 14, true, [37, 99, 235]);
      yPosition += 3;
      report.summary.issuesByCategory.forEach((cat) => {
        addText(`${cat.category}: ${cat.count} issues`, 10);
      });
      yPosition += 5;
      addLine();
    }

    // New Page for Performance Metrics
    doc.addPage();
    yPosition = margin;

    // Performance Metrics
    addText('PERFORMANCE METRICS', 16, true, [37, 99, 235]);
    yPosition += 3;
    addText(`Average Resolution Time: ${report.insights.performanceMetrics.avgResolutionTime} hours`, 11, true);
    addText(`Resolution Rate: ${report.insights.performanceMetrics.resolutionRate}%`, 11, true);
    const trendColor: [number, number, number] = report.insights.trends.issuesVsPreviousPeriod > 0 ? [220, 38, 38] : [34, 197, 94];
    const trendText = `Trend vs Previous Period: ${report.insights.trends.issuesVsPreviousPeriod > 0 ? '+' : ''}${report.insights.trends.issuesVsPreviousPeriod}%`;
    doc.setTextColor(trendColor[0], trendColor[1], trendColor[2]);
    addText(trendText, 11, true, trendColor);
    doc.setTextColor(0, 0, 0);
    yPosition += 5;
    addLine();

    // Critical Assets
    if (report.insights.criticalAssets.length > 0) {
      addText('CRITICAL ASSETS (High Issue Frequency)', 14, true, [220, 38, 38]);
      yPosition += 3;
      report.insights.criticalAssets.forEach((asset, i) => {
        addText(`${i + 1}. ${asset.assetName} - ${asset.issueCount} issues (Avg Resolution: ${asset.avgResolutionTime}h)`, 10);
      });
      yPosition += 5;
      addLine();
    }

    // High Risk Locations
    if (report.insights.trends.highRiskLocations.length > 0) {
      addText('HIGH RISK LOCATIONS', 14, true, [220, 38, 38]);
      yPosition += 3;
      report.insights.trends.highRiskLocations.forEach((loc) => {
        addText(`• ${loc}`, 10);
      });
    }

    // Save the PDF
    doc.save(`${report.reportType}-report-${new Date(report.generatedAt).toISOString().slice(0, 10)}.pdf`);
  };

  const downloadAllAssets = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(api('/api/assets?limit=2000'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch assets');

      const assets = data.assets || [];
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = margin;

      const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = margin;
        }
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.text(text, margin, yPosition);
        yPosition += fontSize / 2 + 2;
      };

      const addLine = () => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = margin;
        }
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 5;
      };

      // Title
      doc.setTextColor(37, 99, 235);
      addText('ALL ASSETS REPORT', 20, true);
      doc.setTextColor(100, 100, 100);
      addText(`Generated: ${new Date().toLocaleString()}`, 10);
      addText(`Total Assets: ${assets.length}`, 10);
      doc.setTextColor(0, 0, 0);
      yPosition += 5;
      addLine();

      // Assets List
      assets.forEach((asset: any, index: number) => {
        if (yPosition > pageHeight - 60) {
          doc.addPage();
          yPosition = margin;
        }

        doc.setTextColor(37, 99, 235);
        addText(`${index + 1}. ${asset.name || 'Unnamed'}`, 12, true);
        doc.setTextColor(0, 0, 0);
        addText(`Asset ID: ${asset.assetId || '-'}`, 9);
        addText(`Category: ${asset.category || '-'} | Status: ${asset.status || '-'}`, 9);
        if (asset.model) addText(`Model: ${asset.model}`, 9);
        if (asset.serialNumber) addText(`Serial: ${asset.serialNumber}`, 9);
        if (asset.locationId?.name) addText(`Location: ${asset.locationId.path || asset.locationId.name}`, 9);
        if (asset.assignedTo?.name) addText(`Assigned to: ${asset.assignedTo.name}`, 9);
        if (asset.purchaseDate) addText(`Purchase Date: ${new Date(asset.purchaseDate).toLocaleDateString()}`, 9);
        if (asset.cost) addText(`Cost: ₹${asset.cost}`, 9);
        yPosition += 3;
        addLine();
      });

      doc.save(`all-assets-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download assets');
    }
  };

  const downloadAllIssues = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(api('/api/issues?limit=2000'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch issues');

      const issues = data.issues || [];
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = margin;

      const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = margin;
        }
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');

        // Handle long text wrapping
        const maxWidth = pageWidth - (2 * margin);
        const lines = doc.splitTextToSize(text, maxWidth);

        lines.forEach((line: string) => {
          if (yPosition > pageHeight - 20) {
            doc.addPage();
            yPosition = margin;
          }
          doc.text(line, margin, yPosition);
          yPosition += fontSize / 2 + 2;
        });
      };

      const addLine = () => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = margin;
        }
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 5;
      };

      const getStatusColor = (status: string): [number, number, number] => {
        switch (status) {
          case 'open': return [234, 179, 8];
          case 'in_progress': return [37, 99, 235];
          case 'completed': return [34, 197, 94];
          case 'cancelled': return [156, 163, 175];
          default: return [0, 0, 0];
        }
      };

      // Title
      doc.setTextColor(37, 99, 235);
      addText('ALL ISSUES REPORT', 20, true);
      doc.setTextColor(100, 100, 100);
      addText(`Generated: ${new Date().toLocaleString()}`, 10);
      addText(`Total Issues: ${issues.length}`, 10);
      doc.setTextColor(0, 0, 0);
      yPosition += 5;
      addLine();

      // Issues List
      issues.forEach((issue: any, index: number) => {
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = margin;
        }

        doc.setTextColor(37, 99, 235);
        addText(`${index + 1}. ${issue.title || 'Untitled Issue'}`, 12, true);
        doc.setTextColor(0, 0, 0);
        addText(`Ticket ID: ${issue.ticketId || '-'}`, 9);

        const statusColor = getStatusColor(issue.status);
        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        addText(`Status: ${issue.status?.replace('_', ' ').toUpperCase() || '-'}`, 9, true);
        doc.setTextColor(0, 0, 0);

        if (issue.category) addText(`Category: ${issue.category.replace('_', ' ')}`, 9);
        if (issue.assetId?.name) addText(`Asset: ${issue.assetId.name} (${issue.assetId.assetId || ''})`, 9);
        if (issue.reporterName) addText(`Reporter: ${issue.reporterName}`, 9);
        if (issue.createdAt) addText(`Reported: ${new Date(issue.createdAt).toLocaleString()}`, 9);
        if (issue.description) {
          addText(`Description: ${issue.description}`, 9);
        }
        yPosition += 3;
        addLine();
      });

      doc.save(`all-issues-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download issues');
    }
  };

  const filteredReports = reports;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading reports...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">📊 Automated Reports</h1>
        <p className="text-gray-600">
          Daily, weekly, and monthly reports with insights, trends, and performance metrics
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Generate Reports Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate New Report</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => generateReport('daily')}
            disabled={generating !== null}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating === 'daily' ? 'Generating...' : '📅 Generate Daily Report'}
          </button>
          <button
            onClick={() => generateReport('weekly')}
            disabled={generating !== null}
            className="px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating === 'weekly' ? 'Generating...' : '📆 Generate Weekly Report'}
          </button>
          <button
            onClick={() => generateReport('monthly')}
            disabled={generating !== null}
            className="px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating === 'monthly' ? 'Generating...' : '📊 Generate Monthly Report'}
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-3">
          💡 Reports are automatically generated daily at 11:59 PM, weekly on Sundays, and monthly on the last day of each month
        </p>
      </div>

      {/* Download All Data Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Download Complete Data</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={downloadAllAssets}
            className="px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 flex items-center justify-center gap-2"
          >
            <span>📦</span>
            <span>Download All Assets (PDF)</span>
          </button>
          <button
            onClick={downloadAllIssues}
            className="px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 flex items-center justify-center gap-2"
          >
            <span>🐛</span>
            <span>Download All Issues (PDF)</span>
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-3">
          📥 Download complete lists of all assets and issues in your organization as PDF files
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {['all', 'daily', 'weekly', 'monthly'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterType === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {type === 'all' ? 'All Reports' : `${type.charAt(0).toUpperCase() + type.slice(1)} Reports`}
          </button>
        ))}
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No reports yet</h3>
          <p className="text-gray-600">Generate your first report using the buttons above</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <div
              key={report._id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`text-3xl`}>
                    {report.reportType === 'daily' ? '📅' :
                     report.reportType === 'weekly' ? '📆' : '📊'}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)} Report
                    </h3>
                    <p className="text-sm text-gray-600">
                      {new Date(report.period.start).toLocaleDateString()} - {new Date(report.period.end).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      Generated: {new Date(report.generatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedReport(selectedReport?._id === report._id ? null : report)}
                    className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    {selectedReport?._id === report._id ? 'Hide Details' : 'View Details'}
                  </button>
                  <button
                    onClick={() => downloadReport(report)}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    📥 Download
                  </button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-600 font-medium">Total Issues</p>
                  <p className="text-2xl font-bold text-blue-900">{report.summary.totalIssuesReported}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm text-green-600 font-medium">Assets Affected</p>
                  <p className="text-2xl font-bold text-green-900">{report.summary.totalAssetsAffected}</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-sm text-purple-600 font-medium">Resolution Rate</p>
                  <p className="text-2xl font-bold text-purple-900">{report.insights.performanceMetrics.resolutionRate}%</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg">
                  <p className="text-sm text-amber-600 font-medium">Avg Resolution</p>
                  <p className="text-2xl font-bold text-amber-900">{report.insights.performanceMetrics.avgResolutionTime}h</p>
                </div>
              </div>

              {/* Detailed View */}
              {selectedReport?._id === report._id && (
                <div className="border-t border-gray-200 pt-4 mt-4 space-y-6">
                  {/* Most Reported Assets */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Most Reported Assets</h4>
                    <div className="space-y-2">
                      {report.summary.mostReportedAssets.slice(0, 5).map((asset, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">{asset.assetName}</p>
                            <p className="text-sm text-gray-600">{asset.assetTag}</p>
                          </div>
                          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                            {asset.issueCount} issues
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Most Reported Locations */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Most Reported Locations</h4>
                    <div className="space-y-2">
                      {report.summary.mostReportedLocations.slice(0, 5).map((loc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <p className="font-medium text-gray-900">{loc.locationName}</p>
                          <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                            {loc.issueCount} issues
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Issues by Status */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Issues by Status</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-700 font-medium">Open</p>
                        <p className="text-xl font-bold text-yellow-900">{report.summary.issuesByStatus.open}</p>
                      </div>
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-700 font-medium">In Progress</p>
                        <p className="text-xl font-bold text-blue-900">{report.summary.issuesByStatus.in_progress}</p>
                      </div>
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-700 font-medium">Completed</p>
                        <p className="text-xl font-bold text-green-900">{report.summary.issuesByStatus.completed}</p>
                      </div>
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-sm text-gray-700 font-medium">Cancelled</p>
                        <p className="text-xl font-bold text-gray-900">{report.summary.issuesByStatus.cancelled}</p>
                      </div>
                    </div>
                  </div>

                  {/* Critical Assets */}
                  {report.insights.criticalAssets.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">⚠️ Critical Assets (High Issue Frequency)</h4>
                      <div className="space-y-2">
                        {report.insights.criticalAssets.map((asset, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div>
                              <p className="font-medium text-red-900">{asset.assetName}</p>
                              <p className="text-sm text-red-700">Avg Resolution: {asset.avgResolutionTime}h</p>
                            </div>
                            <span className="px-3 py-1 bg-red-600 text-white rounded-full text-sm font-medium">
                              {asset.issueCount} issues
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trends */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">📈 Trends</h4>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-gray-700">
                        Issues vs Previous Period:
                        <span className={`ml-2 font-bold ${
                          report.insights.trends.issuesVsPreviousPeriod > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {report.insights.trends.issuesVsPreviousPeriod > 0 ? '+' : ''}
                          {report.insights.trends.issuesVsPreviousPeriod}%
                        </span>
                      </p>
                      {report.insights.trends.highRiskLocations.length > 0 && (
                        <div className="mt-3">
                          <p className="text-gray-700 font-medium mb-2">High Risk Locations:</p>
                          <div className="flex flex-wrap gap-2">
                            {report.insights.trends.highRiskLocations.map((loc, idx) => (
                              <span key={idx} className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm">
                                {loc}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ReportsPage;



