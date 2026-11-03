import { createFileRoute } from "@tanstack/react-router";

import { SectionPage } from "@/components/SectionPage";

export const Route = createFileRoute("/reading")({
  head: () => ({
    meta: [
      { title: "Reading — compreensão de leitura do PTE | PTE Master Hub" },
      {
        name: "description",
        content:
          "MCQ de leitura do PTE com escolha única e múltipla, saldo líquido e análise de armadilhas.",
      },
      { property: "og:title", content: "Reading — PTE Master Hub" },
      { property: "og:description", content: "MCQ de leitura do PTE com análise de armadilhas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <SectionPage section="reading" />,
});
