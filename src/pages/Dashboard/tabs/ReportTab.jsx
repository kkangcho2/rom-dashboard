import { useState, useCallback } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  FileSpreadsheet, FileText, Clipboard, CheckCircle2, Download,
  TrendingUp, TrendingDown, Star
} from 'lucide-react';
import { GlassCard } from '../../../components/ui';
import { CustomTooltip } from '../../../components/charts';

export default function ReportTab({ data }) {
  const [copied, setCopied] = useState(false);

  const handleCopyAll = useCallback(() => {
    if (!data) return;
    const text = data.excelData.map(r => `[${r.category}]\n${r.content}\n${r.detail}`).join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [data]);

  const handleExcelDownload = useCallback(() => {
    if (!data) return;
    const headers = ['카테고리', '분석 내용', '상세 수치'];
    const rows = data.excelData.map(r => [r.category, r.content, r.detail]);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'LivedPulse_분석리포트.csv';
    link.click();
  }, [data]);

  if (!data) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <div className="glass-panel rounded-xl p-8 text-center">
          <FileSpreadsheet size={40} className="text-slate-600 mx-auto mb-4" />
          <h3 className="text-base font-bold text-slate-300 mb-2">엑셀 리포트</h3>
          <p className="text-sm text-slate-500 mb-1">왼쪽에 데이터를 입력하고</p>
          <p className="text-sm text-slate-500">'리포트 생성하기'를 누르세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Export Buttons */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-green-400" />
          리포트 데이터
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleCopyAll}
            className="px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 bg-dark-600/50 border border-dark-600 hover:border-accent/30 hover:bg-dark-600 text-slate-300 transition-all"
          >
            {copied ? <CheckCircle2 size={14} className="text-green-400" /> : <Clipboard size={14} />}
            {copied ? '복사 완료!' : '전체 복사'}
          </button>
          <button
            onClick={handleExcelDownload}
            className="px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 text-green-400 transition-all"
          >
            <Download size={14} />
            Excel 다운로드
          </button>
          <button
            onClick={() => alert('PDF 리포트 기능은 준비 중입니다.')}
            className="px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 transition-all opacity-50 cursor-not-allowed"
            title="준비 중"
          >
            <FileText size={14} />
            PDF 리포트
          </button>
        </div>
      </div>

      {/* Excel Data Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.excelData.map((row, i) => (
          <GlassCard key={i}>
            <div className="text-[10px] text-accent-light font-bold uppercase tracking-wider mb-1">
              {row.category}
            </div>
            <p className="text-xs text-slate-200 mb-1">{row.content}</p>
            <p className="text-[10px] text-slate-500 bg-dark-800/50 rounded p-2 mt-2 border-l-2 border-accent/30">
              {row.detail}
            </p>
          </GlassCard>
        ))}
      </div>

      {/* Economy Section */}
      <div className="border-t border-dark-600/30 pt-4">
        <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-amber-400" />
          게임 내 경제 동향
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          {data.economyData.map((item, i) => (
            <GlassCard key={i}>
              <div className="text-xs font-medium text-slate-200 mb-1">{item.item}</div>
              <div className="text-xl font-bold text-slate-100">{item.thisWeek}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">전주: {item.lastWeek}</div>
              <div className={`text-xs font-medium flex items-center gap-0.5 mt-1 ${item.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                {item.trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {item.change}
              </div>
            </GlassCard>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GlassCard>
            <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <Star size={12} className="text-amber-400" /> 시세 인사이트
            </h4>
            <div className="space-y-2 text-[11px] text-slate-400">
              {data.economyData.map((item, i) => (
                <p key={i}>{item.item} {item.trend === 'up' ? '수요 증가' : '수요 감소'} ({item.change} 변동)</p>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="!p-4">
            <h4 className="text-xs font-semibold text-slate-300 mb-2">주간 시세 변동</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.economyData} margin={{ top: 5, right: 5, bottom: 25, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="item" tick={{ fill: '#64748b', fontSize: 9 }} angle={-25} textAnchor="end" interval={0} height={50} />
                <YAxis tick={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="thisWeek" fill="#f59e0b" name="이번주 시세" radius={[4, 4, 0, 0]}>
                  {data.economyData.map((entry, i) => (
                    <Cell key={i} fill={entry.trend === 'up' ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
