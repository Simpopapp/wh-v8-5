// Fase 7 (projeto 9): ativos dos gráficos de Describe Image.
// Fonte das imagens: Our World in Data (ourworldindata.org) — licença CC BY 4.0,
// com atribuição exibida no motor. Slugs espelham o campo `image` do JSON.
import co2 from "@/assets/describe-image/annual-co2-emissions-per-country.svg";
import electricity from "@/assets/describe-image/electricity-prod-source-stacked.svg";
import energy from "@/assets/describe-image/global-primary-energy.svg";
import internet from "@/assets/describe-image/share-of-individuals-using-the-internet.svg";
import lifeExpectancy from "@/assets/describe-image/life-expectancy.svg";
import measles from "@/assets/describe-image/share-of-children-vaccinated-against-measles.svg";

export const DI_SOURCE_LABEL = "Our World in Data · CC BY 4.0";

export const DESCRIBE_IMAGE_ASSETS: Record<string, string> = {
  "annual-co2-emissions-per-country": co2,
  "electricity-prod-source-stacked": electricity,
  "global-primary-energy": energy,
  "share-of-individuals-using-the-internet": internet,
  "life-expectancy": lifeExpectancy,
  "share-of-children-vaccinated-against-measles": measles,
};
