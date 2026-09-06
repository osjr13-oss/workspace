import { ScanDetail } from "@/components/security/scan-detail";
export default async function ScanPage({ params }: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await params;
  return <ScanDetail scanId={scanId} />;
}
