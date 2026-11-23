import { createFileRoute } from "@tanstack/react-router";
import { GameCanvas } from "@/components/GameCanvas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "翠星の旅人 リオ — 2Dドット絵アクション冒険" },
      {
        name: "description",
        content:
          "オリジナル主人公リオと11の場所を巡る2D見下ろし型ドット絵アクションゲーム。全ての場所を巡り、一時間の旅路の果てに翠光の塔へ。",
      },
      { property: "og:title", content: "翠星の旅人 リオ" },
      {
        property: "og:description",
        content: "3つの星のかけらを集め、島の全てを巡って翠光の塔を目指すドット絵冒険ゲーム。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <GameCanvas />;
}
