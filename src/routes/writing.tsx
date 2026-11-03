import { createFileRoute } from "@tanstack/react-router";

import { SectionPage } from "@/components/SectionPage";

export const Route = createFileRoute("/writing")({
  head: () => ({
    meta: [
      { title: "Writing — resumo em frase única do PTE | PTE Master Hub" },
      {
        name: "description",
        content:
          "Summarize Written Text: resuma textos longos do PTE em uma frase de 5 a 75 palavras.",
      },
      { property: "og:title", content: "Writing — PTE Master Hub" },
      {
        property: "og:description",
        content: "Summarize Written Text do PTE com validador de frase única.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <SectionPage section="writing" />,
});
