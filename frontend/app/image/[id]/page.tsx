import { notFound } from "next/navigation";
import Image1 from "../cards/Image1";
import Image2 from "../cards/Image2";
import Image3 from "../cards/Image3";
import Image4 from "../cards/Image4";

export default async function ImagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cards: Record<string, React.FC> = {
    "1": Image1,
    "2": Image2,
    "3": Image3,
    "4": Image4,
  };

  const Card = cards[id];
  if (!Card) notFound();

  return (
    <div
      style={{
        width: "1200px",
        height: "628px",
        overflow: "hidden",
        position: "relative",
        background: "#07070d",
      }}
    >
      <Card />
    </div>
  );
}
