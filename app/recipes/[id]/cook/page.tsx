import CookingWalkthrough from "@/components/walkthrough/CookingWalkthrough"

export default async function CookPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <CookingWalkthrough id={id} />
}
