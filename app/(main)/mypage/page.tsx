"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/common/Card";
import { useRouteScope } from "@/components/routing/RouteScopeProvider";
import { mockApi } from "@/lib/api/mockApi";
import { useAuthStore } from "@/store/authStore";

interface HistoryItem {
  id: string;
  title: string;
  date: string;
  passRate: string;
  aiUsage: string;
  href: string;
}

export default function MyPage() {
  const { withPrefix } = useRouteScope();
  const user = useAuthStore((state) => state.user);
  const { data } = useQuery({
    queryKey: ["mypage", user?.id],
    queryFn: () => mockApi.getMyDashboard(user!.id),
    enabled: !!user
  });

  return (
    <div className="stack-24">
      <Card className="profile-card">
        <div className="profile-card__main">
          <span className="profile-avatar profile-avatar--lg">{data?.user.name.slice(0, 1) ?? "H"}</span>
          <div className="profile-card__info">
            <span className="eyebrow">마이페이지</span>
            <h1>{data?.user.name ?? "홍길동"}</h1>
            <p className="muted-copy">{data?.user.email ?? "user@email.com"} · AIG 실습 계정</p>
          </div>
        </div>

        <div className="stats-grid">
          {(data?.stats ?? []).map((stat) => (
            <Card key={stat.label} className="stat-card">
              <span className="stat-card__label">{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.note}</small>
            </Card>
          ))}
        </div>
      </Card>

      <Card>
        <div className="section-head">
          <div>
            <span className="eyebrow">이력</span>
            <h2>제출 이력</h2>
          </div>
        </div>

        <div className="history-table">
          <div className="history-row history-row--head">
            <span>과제</span>
            <span>제출일</span>
            <span>통과율</span>
            <span>AI 활용</span>
            <span>열기</span>
          </div>

          {((data?.history ?? []) as HistoryItem[]).map((item) => (
            <div key={`${item.title}-${item.date}`} className="history-row">
              <span>{item.title}</span>
              <span>{item.date}</span>
              <span>{item.passRate}</span>
              <span>{item.aiUsage}</span>
              <Link href={withPrefix(item.href)} className="text-link">
                열기
              </Link>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
