import { createFileRoute } from "@tanstack/react-router";

import { SectionPage } from "@/components/SectionPage";

export const Route = createFileRoute("/speaking")({
  head: () => ({
    meta: [
      { title: "Speaking — treino de fala do PTE | PTE Master Hub" },
      {
        name: "description",
        content:
          "Read Aloud, Repeat Sentence, Retell Lecture e Answer Short Question: pratique a seção de fala do PTE.",
      },
      { property: "og:title", content: "Speaking — PTE Master Hub" },
      {
        property: "og:description",
        content: "Read Aloud, Repeat Sentence, Retell Lecture e Answer Short Question do PTE.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <SectionPage section="speaking" />,
});
