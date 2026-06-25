export default function RecipesLoading() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)" }}>

      {/* Header skeleton */}
      <div style={{ paddingTop: "64px", borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-accent-strip)" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8">
          <div style={{ height: "12px", width: "120px", backgroundColor: "var(--bg-secondary)", borderRadius: "2px", marginBottom: "10px" }} />
          <div style={{ height: "40px", width: "280px", backgroundColor: "var(--bg-secondary)", borderRadius: "2px", marginBottom: "20px" }} />
          <div style={{ height: "46px", maxWidth: "560px", backgroundColor: "var(--bg-secondary)", borderRadius: "2px" }} />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "20px" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="card-base" style={{ borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ aspectRatio: "4/3", backgroundColor: "var(--bg-accent-strip)" }} />
              <div style={{ padding: "14px 16px" }}>
                <div style={{ height: "14px", backgroundColor: "var(--bg-accent-strip)", borderRadius: "2px", marginBottom: "8px", width: "80%" }} />
                <div style={{ height: "12px", backgroundColor: "var(--bg-accent-strip)", borderRadius: "2px", width: "50%" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
