'use client'

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function ReportCharts({ stats, onFilterClick, activeFilter }) {
  // Prepare data for pass/fail pie chart with filter mapping
  const passFailData = [
    { name: 'Passed', value: stats.passedCount, color: '#10b981', filterType: 'compliance', filterValue: 'Full Compliance' },
    { name: 'Failed', value: stats.failedCount, color: '#ef4444', filterType: 'compliance', filterValue: 'Non-Compliant' },
  ]

  // Prepare data for authentication methods chart
  const authData = [
    { name: 'DKIM Pass', value: stats.dkimPass, filterType: 'dkim', filterValue: 'pass' },
    { name: 'DKIM Fail', value: stats.dkimFail, filterType: 'dkim', filterValue: 'fail' },
    { name: 'SPF Pass', value: stats.spfPass, filterType: 'spf', filterValue: 'pass' },
    { name: 'SPF Fail', value: stats.spfFail, filterType: 'spf', filterValue: 'fail' },
  ]

  // Prepare disposition data
  const dispositionData = Object.entries(stats.dispositions).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    filterType: 'disposition',
    filterValue: name,
  }))

  const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b']

  const handlePieClick = (data) => {
    if (data && data.filterType && data.filterValue) {
      onFilterClick(data.filterType, data.filterValue)
    }
  }

  const handleBarClick = (data) => {
    if (data && data.filterType && data.filterValue) {
      onFilterClick(data.filterType, data.filterValue)
    }
  }

  return (
    <div className="report-section">
      <h3>Visual Analysis <span className="filter-hint">Click any chart segment to filter records</span></h3>
      <div className="charts-grid">
        {/* Pass/Fail Distribution */}
        <div className="chart-container clickable-chart">
          <h4>Pass/Fail Distribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={passFailData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                onClick={handlePieClick}
                style={{ cursor: 'pointer' }}
              >
                {passFailData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    opacity={activeFilter?.type === entry.filterType && activeFilter?.value === entry.filterValue ? 1 : 0.8}
                    strokeWidth={activeFilter?.type === entry.filterType && activeFilter?.value === entry.filterValue ? 3 : 0}
                    stroke="#1f2937"
                  />
                ))}
              </Pie>
              <Tooltip cursor={{ fill: 'transparent' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Authentication Results */}
        <div className="chart-container clickable-chart">
          <h4>Authentication Results</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={authData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
              <Bar
                dataKey="value"
                fill="#3b82f6"
                onClick={handleBarClick}
                style={{ cursor: 'pointer' }}
              >
                {authData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill="#3b82f6"
                    opacity={activeFilter?.type === entry.filterType && activeFilter?.value === entry.filterValue ? 1 : 0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Disposition Distribution */}
        {dispositionData.length > 0 && (
          <div className="chart-container clickable-chart">
            <h4>Disposition Distribution</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dispositionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  onClick={handlePieClick}
                  style={{ cursor: 'pointer' }}
                >
                  {dispositionData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      opacity={activeFilter?.type === entry.filterType && activeFilter?.value === entry.filterValue ? 1 : 0.8}
                      strokeWidth={activeFilter?.type === entry.filterType && activeFilter?.value === entry.filterValue ? 3 : 0}
                      stroke="#1f2937"
                    />
                  ))}
                </Pie>
                <Tooltip cursor={{ fill: 'transparent' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
