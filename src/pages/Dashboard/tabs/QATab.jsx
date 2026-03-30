import { useState } from 'react';
import {
  Bug, MessageSquare, ChevronRight, ChevronDown, Send,
  CheckCircle2, AlertTriangle
} from 'lucide-react';
import { SeverityBadge, StatusBadge } from '../../../components/ui/Badges';

export default function QATab({ data, url }) {
  const [expandedBug, setExpandedBug] = useState(null);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <Bug size={18} className="text-red-400" />
          크리에이터: {data._channelName || url?.split('@')[1] || '분석 대상'} 방송 QA 리포트
        </h3>
        <span className="text-xs px-3 py-1 rounded-full bg-red-500/20 text-red-400 font-medium border border-red-500/30">
          {data.bugReports.length}건 감지
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.bugReports.map((bug) => (
          <div
            key={bug.id}
            className="bg-red-500/5 border border-red-500/20 rounded-xl overflow-hidden cursor-pointer hover:border-red-500/40 transition-colors"
            onClick={() => setExpandedBug(expandedBug === bug.id ? null : bug.id)}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={bug.severity} />
                  <StatusBadge status={bug.status} />
                </div>
                <span className="text-[10px] font-mono text-slate-500">{bug.time}</span>
              </div>
              <p className="text-sm text-slate-200 font-medium mb-2">{bug.issue}</p>
              <p className="text-[10px] text-slate-500 mb-2">
                크리에이터 방송 중 발생 - {data._channelName || url?.split('@')[1] || '분석 대상'}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <MessageSquare size={10} />
                <span>채팅 언급 {bug.count}건</span>
                {expandedBug === bug.id ? <ChevronDown size={10} className="ml-auto" /> : <ChevronRight size={10} className="ml-auto" />}
              </div>
            </div>
            {expandedBug === bug.id && (
              <div className="border-t border-red-500/20 p-4 bg-red-500/5 text-[11px] space-y-2 animate-fade-in-up">
                <div className="flex justify-between text-slate-400">
                  <span>발생 시간</span><span className="text-slate-200">{bug.time}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>심각도</span><span className="text-slate-200 uppercase">{bug.severity}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>채팅 언급 수</span><span className="text-slate-200">{bug.count}건</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>상태</span><span className="text-slate-200">{bug.status}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>관련 크리에이터</span><span className="text-slate-200">{data._channelName || url?.split('@')[1] || '분석 대상'}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); alert('개발팀 전달 기능은 준비 중입니다.'); }}
                  className="w-full mt-2 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs transition-colors flex items-center justify-center gap-1 opacity-50 cursor-not-allowed"
                  title="준비 중"
                >
                  <Send size={10} /> 개발팀 전달
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
