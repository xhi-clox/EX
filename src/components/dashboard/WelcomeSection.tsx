export function WelcomeSection() {
    return (
        <section className="bg-surface rounded-lg p-6 shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-border flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold mb-1.5 bg-gradient-to-r from-text-primary to-primary-light bg-clip-text text-transparent">
                  Welcome back, Professor!
              </h1>
              <p className="text-text-secondary text-sm">
                Here's a summary of your recent activity and quick access to your most used features.
              </p>
            </div>
        </section>
    )
}
