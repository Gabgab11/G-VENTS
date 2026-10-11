export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <main className="wrap" style={{ padding: "40px 20px" }}><h1>Event: {slug}</h1><p className="muted">The public event page is the next step.</p></main>;
}
