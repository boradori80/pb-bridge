"use client";

import React, { useState, useEffect, useRef } from "react";

// Mock Data for past conversions
const INITIAL_HISTORY = [
  {
    id: "1",
    fileName: "dw_sales_summary.srd",
    fileType: "DataWindow (.srd)",
    targetType: "React Table + Tailwind",
    size: "24.5 KB",
    date: "2026-05-22 10:14",
    status: "Completed",
    code: `import React, { useState } from 'react';

export default function SalesSummaryTable() {
  const [filter, setFilter] = useState('');
  const data = [
    { id: 1, region: 'East', rep: 'Alice', sales: 15200, status: 'Closed' },
    { id: 2, region: 'West', rep: 'Bob', sales: 9800, status: 'Pending' },
    { id: 3, region: 'North', rep: 'Charlie', sales: 22000, status: 'Closed' },
    { id: 4, region: 'South', rep: 'Diana', sales: 14300, status: 'Closed' },
  ];

  const filteredData = data.filter(item => 
    item.rep.toLowerCase().includes(filter.toLowerCase()) ||
    item.region.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="w-full p-6 bg-slate-900 border border-slate-800 rounded-xl text-slate-100">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Sales Summary</h2>
          <p className="text-sm text-slate-400">Migrated from dw_sales_summary.srd</p>
        </div>
        <input 
          type="text" 
          placeholder="Filter by Rep or Region..." 
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="overflow-x-auto border border-slate-850 rounded-lg">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-medium">
              <th className="py-3 px-4">Region</th>
              <th className="py-3 px-4">Sales Rep</th>
              <th className="py-3 px-4 text-right">Sales Amount</th>
              <th className="py-3 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filteredData.map(item => (
              <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-4 text-white font-medium">{item.region}</td>
                <td className="py-3 px-4">{item.rep}</td>
                <td className="py-3 px-4 text-right text-indigo-400 font-mono">\${item.sales.toLocaleString()}</td>
                <td className="py-3 px-4 text-center">
                  <span className={\`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium \${
                    item.status === 'Closed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }\`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}`,
  },
  {
    id: "2",
    fileName: "w_order_entry.srw",
    fileType: "Window (.srw)",
    targetType: "React Form + State",
    size: "42.1 KB",
    date: "2026-05-22 09:45",
    status: "Completed",
    code: `import React, { useState } from 'react';

export default function OrderEntryForm() {
  const [formData, setFormData] = useState({
    customerId: '',
    orderDate: new Date().toISOString().split('T')[0],
    itemCode: '',
    quantity: 1,
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Order submitted: ' + JSON.stringify(formData));
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-slate-900 border border-slate-800 rounded-xl text-slate-100">
      <h2 className="text-xl font-bold text-white mb-1">Order Entry Form</h2>
      <p className="text-sm text-slate-400 mb-6">Migrated from w_order_entry.srw</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Customer ID</label>
          <input 
            type="text" 
            required
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            placeholder="e.g. CUST-90210"
            value={formData.customerId}
            onChange={e => setFormData({...formData, customerId: e.target.value})}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Order Date</label>
            <input 
              type="date" 
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={formData.orderDate}
              onChange={e => setFormData({...formData, orderDate: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Quantity</label>
            <input 
              type="number" 
              min="1"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={formData.quantity}
              onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Item Code</label>
          <select 
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            value={formData.itemCode}
            onChange={e => setFormData({...formData, itemCode: e.target.value})}
          >
            <option value="">Select an item...</option>
            <option value="PROD-A">Premium License (PROD-A)</option>
            <option value="PROD-B">Enterprise Bundle (PROD-B)</option>
            <option value="PROD-C">Developer Standard (PROD-C)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Special Notes</label>
          <textarea 
            rows={3}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-slate-500"
            placeholder="Enter any custom requirements..."
            value={formData.notes}
            onChange={e => setFormData({...formData, notes: e.target.value})}
          />
        </div>

        <button 
          type="submit"
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg font-medium text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
        >
          Submit Order
        </button>
      </form>
    </div>
  );
}`,
  },
  {
    id: "3",
    fileName: "uo_db_connector.sru",
    fileType: "UserObject (.sru)",
    targetType: "React Context / API",
    size: "18.3 KB",
    date: "2026-05-21 16:30",
    status: "Failed",
    code: `// PB-Bridge Compiler Error Log
// File: uo_db_connector.sru
// Timestamp: 2026-05-21 16:30

[ERROR] Failed to compile uo_db_connector.sru:
Line 42: SQLCA.DBMS = "ODBC" is using a dynamic driver binding that is not supported.
PB-Bridge recommendation: Use a centralized Next.js API route or Prisma Client.
Please check connection strings and rewrite DB connection routines manually.`,
  },
];

export default function PBBridgeDashboard() {
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Conversion simulation states
  const [isConverting, setIsConverting] = useState(false);
  const [convertingFileName, setConvertingFileName] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  const [previewFile, setPreviewFile] = useState<{ name: string; size: string; content: string } | null>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      startConversion(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      startConversion(files[0]);
    }
  };

  // Simulated Compiler Function
  const startConversion = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["srd", "srw", "sru", "srp"].includes(extension || "")) {
      alert("Only PowerBuilder source files (.srd, .srw, .sru, .srp) are supported.");
      return;
    }

    // Read file content for preview using FileReader
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setPreviewFile({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        content: text || ""
      });
    };
    reader.readAsText(file);

    setIsConverting(true);
    setConvertingFileName(file.name);
    setLogs([]);
    setProgress(0);

    const logSteps = [
      { text: "🚀 Initializing PB-Bridge AST Parser v0.1.0...", delay: 300, progress: 10 },
      { text: `📂 Reading input file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`, delay: 600, progress: 25 },
      { text: "🔍 Analyzing PowerBuilder source syntax structure...", delay: 900, progress: 40 },
      { text: extension === "srd" 
        ? "⚡ Found DataWindow definition. Mapping DW layout to Next.js Client Component..." 
        : "⚡ Found Window layout. Mapping standard Controls (CommandButton, SingleLineEdit)...", delay: 1300, progress: 65 },
      { text: "🎨 Synthesizing responsive Tailwind CSS styles...", delay: 1800, progress: 85 },
      { text: "✨ Resolving event handlers and state triggers...", delay: 2200, progress: 95 },
      { text: "✅ Conversion successful! Next.js component ready.", delay: 2500, progress: 100 }
    ];

    logSteps.forEach((step, index) => {
      setTimeout(() => {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${step.text}`]);
        setProgress(step.progress);

        // On complete
        if (index === logSteps.length - 1) {
          setTimeout(() => {
            const targetName = file.name.replace(/\.[^/.]+$/, "") + (extension === "srd" ? "Table" : "Form");
            const generatedCode = generateMockCode(file.name, extension || "", targetName);
            
            const newHistoryItem = {
              id: Date.now().toString(),
              fileName: file.name,
              fileType: extension === "srd" ? "DataWindow (.srd)" : extension === "srw" ? "Window (.srw)" : "Object",
              targetType: extension === "srd" ? "React Table + Tailwind" : "React Form + State",
              size: `${(file.size / 1024).toFixed(1)} KB`,
              date: new Date().toISOString().replace("T", " ").substring(0, 16),
              status: "Completed",
              code: generatedCode,
            };

            setHistory((prev) => [newHistoryItem, ...prev]);
            setIsConverting(false);
          }, 300);
        }
      }, step.delay);
    });
  };

  const generateMockCode = (fileName: string, ext: string, componentName: string) => {
    if (ext === "srd") {
      return `import React from 'react';

// Automatically generated by PB-Bridge from ${fileName}
export default function ${componentName}() {
  const columns = ['Code', 'Name', 'Description', 'Quantity', 'Price'];
  const items = [
    { code: 'A001', name: 'Standard Widget', desc: 'Default assembly item', qty: 120, price: 12.50 },
    { code: 'B005', name: 'Turbo Engine', desc: 'High capacity model', qty: 15, price: 340.00 },
    { code: 'C012', name: 'Flexible Tubing', desc: '10m weatherproof roll', qty: 85, price: 8.99 },
  ];

  return (
    <div className="w-full p-6 bg-slate-900 border border-slate-800 rounded-xl text-slate-100">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white">${componentName}</h3>
        <p className="text-xs text-slate-400">Source: ${fileName}</p>
      </div>
      <div className="overflow-x-auto border border-slate-800 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-800/50 text-slate-300 font-semibold uppercase tracking-wider">
            <tr>
              {columns.map(col => <th key={col} className="p-3">{col}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-800/20">
                <td className="p-3 font-mono text-indigo-400">{item.code}</td>
                <td className="p-3 text-white font-medium">{item.name}</td>
                <td className="p-3 text-slate-400">{item.desc}</td>
                <td className="p-3 font-mono text-right">{item.qty}</td>
                <td className="p-3 font-mono text-right text-emerald-400">\${item.price.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}`;
    } else {
      return `import React, { useState } from 'react';

// Automatically generated by PB-Bridge from ${fileName}
export default function ${componentName}() {
  const [submitting, setSubmitting] = useState(false);

  const handleAction = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      alert('Action executed successfully!');
    }, 1000);
  };

  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-slate-200">
      <h3 className="text-lg font-bold text-white mb-2">${componentName}</h3>
      <p className="text-xs text-slate-400 mb-6">Generated Layout (Source: ${fileName})</p>
      
      <div className="space-y-4">
        <div className="p-4 bg-slate-950/50 border border-slate-850 rounded-lg">
          <p className="text-xs text-slate-400 mb-2">Control Elements Map</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-800 p-2 rounded">cb_ok (Button)</div>
            <div className="bg-slate-800 p-2 rounded">sle_input (Input)</div>
          </div>
        </div>

        <button 
          onClick={handleAction}
          disabled={submitting}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-all"
        >
          {submitting ? 'Executing...' : 'OK (cb_ok)'}
        </button>
      </div>
    </div>
  );
}`;
    }
  };

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openCodeModal = (item: any) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans flex flex-col antialiased">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
              PB-Bridge
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                v0.1.0 Beta
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">PowerBuilder Migration Suite</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <a href="#" className="hover:text-white transition-colors text-indigo-400 border-b-2 border-indigo-500 pb-1">
            Dashboard
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Rule Settings
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Documentation
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs text-slate-400 font-mono">Engine Online</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col gap-8">
        
        {/* Hero Banner & Drag-and-Drop Area */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          
          {/* Info Card */}
          <div className="lg:col-span-1 flex flex-col justify-between p-6 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
                Migration Assistant
              </span>
              <h2 className="text-2xl font-bold text-white mt-4 tracking-tight leading-tight">
                Bridge Legacy Desktop to Modern Web
              </h2>
              <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                PB-Bridge converts PowerBuilder source files (DataWindow <b>.srd</b> and Window <b>.srw</b>) into react-friendly TSX components powered by Tailwind CSS.
              </p>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-800/60 space-y-3">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center text-[10px] font-bold text-indigo-400 font-mono">1</div>
                <span>Drop any PB exports (.srd / .srw)</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center text-[10px] font-bold text-indigo-400 font-mono">2</div>
                <span>AST structure analysis & mapping</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center text-[10px] font-bold text-indigo-400 font-mono">3</div>
                <span>Download or copy generated React code</span>
              </div>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div className="lg:col-span-2 flex flex-col">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 relative overflow-hidden group min-h-[300px] ${
                isDragging
                  ? "border-indigo-500 bg-indigo-500/10 shadow-inner scale-[1.01]"
                  : "border-slate-800 bg-slate-900/30 hover:border-slate-700 hover:bg-slate-900/40 hover:shadow-lg hover:shadow-indigo-500/5"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept=".srd,.srw,.sru,.srp"
              />

              {/* Decorative Glow */}
              <div className="absolute -right-20 -top-20 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all duration-500"></div>
              <div className="absolute -left-20 -bottom-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all duration-500"></div>

              <div className="w-16 h-16 rounded-2xl bg-slate-850 flex items-center justify-center mb-4 border border-slate-800 group-hover:scale-110 transition-transform duration-300">
                <svg
                  className="w-8 h-8 text-indigo-400 group-hover:text-indigo-300 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>

              <h3 className="text-lg font-semibold text-white tracking-tight">
                Drag & Drop PowerBuilder Source File
              </h3>
              <p className="text-slate-400 text-sm mt-2 max-w-sm">
                Drop your exported <code className="text-indigo-400 font-mono font-medium">.srd</code>, <code className="text-indigo-400 font-mono font-medium">.srw</code>, or <code className="text-indigo-400 font-mono font-medium">.sru</code> file here, or click to browse files.
              </p>
              <span className="mt-4 text-xs text-slate-500">
                Supports exports from PB 12.5 up to PB 2022
              </span>
            </div>
          </div>
        </section>

        {/* Compiler Logs Panel (Visible during active compile) */}
        {isConverting && (
          <section className="bg-slate-950 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="px-5 py-3.5 border-b border-slate-900 bg-slate-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>
                <span className="text-xs font-semibold text-slate-300 font-mono">
                  compiler-terminal://{convertingFileName}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono font-semibold">{progress}%</span>
                <div className="w-20 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <div className="p-5 font-mono text-xs text-slate-300 space-y-2 bg-[#090d16] max-h-56 overflow-y-auto scrollbar-thin">
              {logs.map((log, idx) => (
                <div key={idx} className="leading-relaxed whitespace-pre-wrap animate-in fade-in duration-200">
                  {log.includes("✅") || log.includes("Success") ? (
                    <span className="text-emerald-400 font-medium">{log}</span>
                  ) : log.includes("🚀") ? (
                    <span className="text-indigo-400 font-bold">{log}</span>
                  ) : (
                    log
                  )}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          </section>
        )}

        {/* History Table Section */}
        <section className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md">
          <div className="p-6 border-b border-slate-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Conversion History</h3>
              <p className="text-slate-400 text-xs mt-1">Recently parsed PowerBuilder modules and target outputs</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-medium font-mono">
                Total: {history.length} Files
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800/60 text-slate-400 font-semibold text-xs tracking-wider uppercase">
                  <th className="py-4 px-6">File Name</th>
                  <th className="py-4 px-6">Type</th>
                  <th className="py-4 px-6">Target Component</th>
                  <th className="py-4 px-6">Size</th>
                  <th className="py-4 px-6">Converted At</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          item.status === 'Failed' 
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <span className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                          {item.fileName}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-400 text-xs font-mono">{item.fileType}</td>
                    <td className="py-4 px-6 text-slate-300 font-medium text-xs font-mono">{item.targetType}</td>
                    <td className="py-4 px-6 text-slate-400 text-xs font-mono">{item.size}</td>
                    <td className="py-4 px-6 text-slate-400 text-xs font-mono">{item.date}</td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        item.status === "Completed"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/20"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2.5">
                        {item.status === "Completed" ? (
                          <>
                            <button
                              onClick={() => handleCopyCode(item.code, item.id)}
                              className="p-1.5 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-all text-xs font-medium flex items-center gap-1.5 hover:text-white"
                              title="Copy Code"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                              </svg>
                              {copiedId === item.id ? "Copied" : "Copy"}
                            </button>
                            <button
                              onClick={() => openCodeModal(item)}
                              className="p-1.5 rounded bg-indigo-600 hover:bg-indigo-500 transition-all text-xs font-medium text-white flex items-center gap-1.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                              </svg>
                              View Code
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => openCodeModal(item)}
                            className="p-1.5 rounded bg-red-950/20 border border-red-800/30 hover:bg-red-900/30 transition-all text-xs font-medium text-red-400 flex items-center gap-1.5"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Error Log
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Source Code Preview Section */}
        {previewFile && (
          <section className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-slate-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
                  Source Preview
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight mt-2 flex items-center gap-2">
                  <span>{previewFile.name}</span>
                  <span className="text-xs font-normal text-slate-400 font-mono">({previewFile.size})</span>
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(previewFile.content);
                    setCopiedPreview(true);
                    setTimeout(() => setCopiedPreview(false), 2000);
                  }}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  {copiedPreview ? "Copied!" : "Copy Code"}
                </button>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="px-4 py-2 bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-900/30 rounded-lg text-xs font-semibold transition-all"
                >
                  Close Preview
                </button>
              </div>
            </div>
            <div className="p-5 font-mono text-xs text-slate-300 bg-[#090d16]/90 max-h-96 overflow-y-auto scrollbar-thin">
              <pre className="whitespace-pre overflow-x-auto leading-relaxed">{previewFile.content}</pre>
            </div>
          </section>
        )}
      </main>

      {/* Code / Error Log Modal */}
      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-[#1e293b] border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in scale-in duration-300">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{selectedItem.status === 'Failed' ? 'Compiler Error Output' : 'Generated Next.js / Tailwind Code'}</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full ${
                    selectedItem.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {selectedItem.fileName}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">PB-Bridge generated code representation</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Code Viewer */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#0f172a] text-slate-300 font-mono text-xs leading-relaxed max-h-[60vh] scrollbar-thin">
              <pre className="whitespace-pre-wrap">{selectedItem.code}</pre>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/60">
              <span className="text-xs text-slate-400">
                PB-Bridge Engine v0.1.0 • Compiled with React 19 rules
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  Close
                </button>
                {selectedItem.status === "Completed" && (
                  <button
                    onClick={() => handleCopyCode(selectedItem.code, "modal")}
                    className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-2 active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    {copiedId === "modal" ? "Copied!" : "Copy Code"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
