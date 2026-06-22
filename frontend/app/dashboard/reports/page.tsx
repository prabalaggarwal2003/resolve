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

const REPORT_TYPE_STYLES: Record<string, { badge: string; accent: string; hover: string }> = {
  daily: {
    badge: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
    accent: 'border-l-blue-500/60',
    hover: 'hover:border-blue-500/25',
  },
  weekly: {
    badge: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
    accent: 'border-l-emerald-500/60',
    hover: 'hover:border-emerald-500/25',
  },
  monthly: {
    badge: 'text-violet-300 bg-violet-500/15 border-violet-500/30',
    accent: 'border-l-violet-500/60',
    hover: 'hover:border-violet-500/25',
  },
};

const GENERATE_BTN_STYLES: Record<string, string> = {
  daily: 'border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400/50',
  weekly: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/50',
  monthly: 'border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:border-violet-400/50',
};

const FILTER_ACTIVE_STYLES: Record<string, string> = {
  all: 'bg-gray-600/50 text-gray-100 border-gray-500/50',
  daily: 'bg-blue-500/20 text-blue-200 border-blue-500/40',
  weekly: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
  monthly: 'bg-violet-500/20 text-violet-200 border-violet-500/40',
};

function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const reportsPerPage = 10;
  const [userRole, setUserRole] = useState('');
  const [userDeptId, setUserDeptId] = useState('');
  const [userDeptName, setUserDeptName] = useState('');

  useEffect(() => {
    try {
      const u = localStorage.getItem('user');
      if (u) {
        const parsed = JSON.parse(u);
        setUserRole(parsed?.role ?? '');
        setUserDeptId(parsed?.departmentId ?? '');
        setUserDeptName(parsed?.departmentName ?? '');
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchReports();
    setCurrentPage(1);
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
      const params = new URLSearchParams({ limit: '2000' });
      if (userRole === 'manager' && userDeptId) params.set('departmentId', userDeptId);

      const res = await fetch(api(`/api/assets?${params.toString()}`), {
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
        if (yPosition > pageHeight - 20) { doc.addPage(); yPosition = margin; }
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.text(text, margin, yPosition);
        yPosition += fontSize / 2 + 2;
      };

      const addLine = () => {
        if (yPosition > pageHeight - 20) { doc.addPage(); yPosition = margin; }
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 5;
      };

      const title = userRole === 'manager' && userDeptName
        ? `ASSETS REPORT — ${userDeptName.toUpperCase()} DEPT`
        : 'ALL ASSETS REPORT';

      doc.setTextColor(37, 99, 235);
      addText(title, 20, true);
      doc.setTextColor(100, 100, 100);
      addText(`Generated: ${new Date().toLocaleString()}`, 10);
      addText(`Total Assets: ${assets.length}`, 10);
      doc.setTextColor(0, 0, 0);
      yPosition += 5;
      addLine();

      assets.forEach((asset: any, index: number) => {
        if (yPosition > pageHeight - 60) { doc.addPage(); yPosition = margin; }
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

      doc.save(`assets-${userRole === 'manager' && userDeptName ? userDeptName.toLowerCase().replace(/\s+/g, '-') + '-' : ''}${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download assets');
    }
  };

  const downloadAllIssues = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // Backend issues route already scopes by dept for manager via JWT
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
        if (yPosition > pageHeight - 20) { doc.addPage(); yPosition = margin; }
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        const maxWidth = pageWidth - (2 * margin);
        const lines = doc.splitTextToSize(text, maxWidth);
        lines.forEach((line: string) => {
          if (yPosition > pageHeight - 20) { doc.addPage(); yPosition = margin; }
          doc.text(line, margin, yPosition);
          yPosition += fontSize / 2 + 2;
        });
      };

      const addLine = () => {
        if (yPosition > pageHeight - 20) { doc.addPage(); yPosition = margin; }
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

      const title = userRole === 'manager' && userDeptName
        ? `ISSUES REPORT — ${userDeptName.toUpperCase()} DEPT`
        : 'ALL ISSUES REPORT';

      doc.setTextColor(37, 99, 235);
      addText(title, 20, true);
      doc.setTextColor(100, 100, 100);
      addText(`Generated: ${new Date().toLocaleString()}`, 10);
      addText(`Total Issues: ${issues.length}`, 10);
      doc.setTextColor(0, 0, 0);
      yPosition += 5;
      addLine();

      issues.forEach((issue: any, index: number) => {
        if (yPosition > pageHeight - 80) { doc.addPage(); yPosition = margin; }
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
        if (issue.description) addText(`Description: ${issue.description}`, 9);
        yPosition += 3;
        addLine();
      });

      doc.save(`issues-${userRole === 'manager' && userDeptName ? userDeptName.toLowerCase().replace(/\s+/g, '-') + '-' : ''}${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download issues');
    }
  };

  const filteredReports = reports;

  // Pagination calculations
  const totalPages = Math.ceil(filteredReports.length / reportsPerPage);
  const startIndex = (currentPage - 1) * reportsPerPage;
  const endIndex = startIndex + reportsPerPage;
  const currentReports = filteredReports.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        <span className="ml-3 text-gray-400">Loading reports...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100 mb-2">Automated Reports</h1>
        <p className="text-gray-400">
          Daily, weekly and monthly reports you can generate on demand. Get insights into issue trends, asset performance and more.
        </p>
        {userRole === 'manager' && userDeptName && (
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-900/20 border border-blue-800/50 text-blue-300 text-sm">
            🏢 Showing data for <strong>{userDeptName}</strong> department only
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Generate & export — compact action bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-blue-500/50 bg-gradient-to-r from-blue-950/20 to-gray-800/40 px-4 py-3">
          <p className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-2">Generate report</p>
          <div className="flex flex-wrap gap-2">
            {(['daily', 'weekly', 'monthly'] as const).map((type) => (
              <button
                key={type}
                onClick={() => generateReport(type)}
                disabled={generating !== null}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${GENERATE_BTN_STYLES[type]}`}
              >
                {generating === type ? 'Generating…' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-700/60 border-l-2 border-l-amber-500/50 bg-gradient-to-r from-amber-950/15 to-gray-800/40 px-4 py-3">
          <p className="text-xs font-semibold text-amber-400/80 uppercase tracking-widest mb-2">Download data</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={downloadAllAssets}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 hover:border-teal-400/50 transition-colors"
            >
              Assets PDF
            </button>
            <button
              onClick={downloadAllIssues}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:border-rose-400/50 transition-colors"
            >
              Issues PDF
            </button>
          </div>
          {userRole === 'manager' && userDeptName && (
            <p className="text-xs text-amber-500/60 mt-2">Scoped to {userDeptName} department</p>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {['all', 'daily', 'weekly', 'monthly'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filterType === type
                ? FILTER_ACTIVE_STYLES[type]
                : 'bg-gray-800/40 text-gray-400 border-gray-700/60 hover:bg-gray-700/60 hover:text-gray-200'
            }`}
          >
            {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-blue-500/20 bg-blue-950/10 px-4 py-8 text-center">
          <p className="text-sm font-medium text-gray-300 mb-1">No reports yet</p>
          <p className="text-xs text-gray-500">Generate your first report using the buttons above</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {currentReports.map((report) => {
              const typeStyle = REPORT_TYPE_STYLES[report.reportType] ?? REPORT_TYPE_STYLES.daily;
              return (
            <div
              key={report._id}
              className={`rounded-xl border border-gray-700/60 border-l-2 ${typeStyle.accent} bg-gray-800/40 px-4 py-3 ${typeStyle.hover} transition-colors`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${typeStyle.badge}`}>
                      {report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(report.period.start).toLocaleDateString()} – {new Date(report.period.end).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1">
                    Generated {new Date(report.generatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => setSelectedReport(selectedReport?._id === report._id ? null : report)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                      selectedReport?._id === report._id
                        ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                        : 'border-gray-700/60 bg-gray-800/60 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
                    }`}
                  >
                    {selectedReport?._id === report._id ? 'Hide' : 'Details'}
                  </button>
                  <button
                    onClick={() => downloadReport(report)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 hover:border-teal-400/50 transition-colors"
                  >
                    Download
                  </button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <div className="px-2 py-1.5 rounded-lg border border-blue-800/30 bg-blue-900/15">
                  <p className="text-[10px] text-blue-400/70 uppercase tracking-wide">Issues</p>
                  <p className="text-sm font-semibold text-blue-300">{report.summary.totalIssuesReported}</p>
                </div>
                <div className="px-2 py-1.5 rounded-lg border border-emerald-800/30 bg-emerald-900/15">
                  <p className="text-[10px] text-emerald-400/70 uppercase tracking-wide">Assets</p>
                  <p className="text-sm font-semibold text-emerald-300">{report.summary.totalAssetsAffected}</p>
                </div>
                <div className="px-2 py-1.5 rounded-lg border border-violet-800/30 bg-violet-900/15">
                  <p className="text-[10px] text-violet-400/70 uppercase tracking-wide">Resolution</p>
                  <p className="text-sm font-semibold text-violet-300">{report.insights.performanceMetrics.resolutionRate}%</p>
                </div>
                <div className="px-2 py-1.5 rounded-lg border border-amber-800/30 bg-amber-900/15">
                  <p className="text-[10px] text-amber-400/70 uppercase tracking-wide">Avg time</p>
                  <p className="text-sm font-semibold text-amber-300">{report.insights.performanceMetrics.avgResolutionTime}h</p>
                </div>
              </div>

              {/* Detailed View */}
              {selectedReport?._id === report._id && (
                <div className="border-t border-gray-700/60 pt-3 mt-3 space-y-4">
                  {/* Most Reported Assets */}
                  <div>
                    <h4 className="text-xs font-semibold text-blue-400/80 uppercase tracking-widest mb-1.5">Most reported assets</h4>
                    <div className="space-y-1">
                      {report.summary.mostReportedAssets.slice(0, 5).map((asset, idx) => (
                        <div key={idx} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-blue-950/20 border border-blue-800/20">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-200 truncate">{asset.assetName}</p>
                            <p className="text-[11px] text-gray-500 truncate">{asset.assetTag}</p>
                          </div>
                          <span className="ml-2 shrink-0 px-2 py-0.5 text-[11px] font-medium text-red-400 bg-red-900/20 border border-red-800/40 rounded-md">
                            {asset.issueCount} issues
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Most Reported Locations */}
                  <div>
                    <h4 className="text-xs font-semibold text-amber-400/80 uppercase tracking-widest mb-1.5">Most reported locations</h4>
                    <div className="space-y-1">
                      {report.summary.mostReportedLocations.slice(0, 5).map((loc, idx) => (
                        <div key={idx} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-amber-950/15 border border-amber-800/20">
                          <p className="text-xs font-medium text-gray-200 truncate">{loc.locationName}</p>
                          <span className="ml-2 shrink-0 px-2 py-0.5 text-[11px] font-medium text-amber-400 bg-amber-900/20 border border-amber-800/40 rounded-md">
                            {loc.issueCount} issues
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Issues by Status */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Issues by status</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      <div className="px-2 py-1.5 rounded-lg border border-yellow-800/30 bg-yellow-900/10">
                        <p className="text-[10px] text-yellow-500/80 uppercase tracking-wide">Open</p>
                        <p className="text-sm font-semibold text-yellow-400">{report.summary.issuesByStatus.open}</p>
                      </div>
                      <div className="px-2 py-1.5 rounded-lg border border-blue-800/30 bg-blue-900/10">
                        <p className="text-[10px] text-blue-500/80 uppercase tracking-wide">In progress</p>
                        <p className="text-sm font-semibold text-blue-400">{report.summary.issuesByStatus.in_progress}</p>
                      </div>
                      <div className="px-2 py-1.5 rounded-lg border border-green-800/30 bg-green-900/10">
                        <p className="text-[10px] text-green-500/80 uppercase tracking-wide">Completed</p>
                        <p className="text-sm font-semibold text-green-400">{report.summary.issuesByStatus.completed}</p>
                      </div>
                      <div className="px-2 py-1.5 rounded-lg border border-gray-600/40 bg-gray-800/40">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Cancelled</p>
                        <p className="text-sm font-semibold text-gray-400">{report.summary.issuesByStatus.cancelled}</p>
                      </div>
                    </div>
                  </div>

                  {/* Critical Assets */}
                  {report.insights.criticalAssets.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-red-400/80 uppercase tracking-widest mb-1.5">Critical assets</h4>
                      <div className="space-y-1">
                        {report.insights.criticalAssets.map((asset, idx) => (
                          <div key={idx} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-red-900/10 border border-red-800/30">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-red-300 truncate">{asset.assetName}</p>
                              <p className="text-[11px] text-red-400/70">Avg resolution: {asset.avgResolutionTime}h</p>
                            </div>
                            <span className="ml-2 shrink-0 px-2 py-0.5 text-[11px] font-medium text-red-300 bg-red-900/30 border border-red-800/40 rounded-md">
                              {asset.issueCount} issues
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trends */}
                  <div>
                    <h4 className="text-xs font-semibold text-cyan-400/80 uppercase tracking-widest mb-1.5">Trends</h4>
                    <div className="px-2 py-2 rounded-lg bg-cyan-950/15 border border-cyan-800/20">
                      <p className="text-xs text-gray-400">
                        Issues vs previous period:
                        <span className={`ml-1.5 font-semibold ${
                          report.insights.trends.issuesVsPreviousPeriod > 0 ? 'text-red-400' : 'text-green-400'
                        }`}>
                          {report.insights.trends.issuesVsPreviousPeriod > 0 ? '+' : ''}
                          {report.insights.trends.issuesVsPreviousPeriod}%
                        </span>
                      </p>
                      {report.insights.trends.highRiskLocations.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[11px] text-gray-500 mb-1">High risk locations</p>
                          <div className="flex flex-wrap gap-1">
                            {report.insights.trends.highRiskLocations.map((loc, idx) => (
                              <span key={idx} className="px-1.5 py-0.5 text-[11px] text-red-400 bg-red-900/20 border border-red-800/30 rounded">
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
            );
            })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-2.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-gray-500">
                {startIndex + 1}–{Math.min(endIndex, filteredReports.length)} of {filteredReports.length}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 text-xs font-medium border border-gray-700/60 bg-gray-800/60 text-gray-400 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700/60 hover:text-gray-200 transition-colors"
                >
                  Prev
                </button>
                <span className="px-2 text-xs text-gray-500">
                  {currentPage}/{totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-2.5 py-1 text-xs font-medium border border-gray-700/60 bg-gray-800/60 text-gray-400 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700/60 hover:text-gray-200 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </>
      )}
    </div>
  );
}

export default ReportsPage;



