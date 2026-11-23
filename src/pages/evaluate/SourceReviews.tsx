
import type { SourceReview } from '../../types'

interface SourceReviewsProps {
  reviews: SourceReview[]
}

export function SourceReviews({ reviews }: SourceReviewsProps) {
  return (
    <section className="rounded-lg border border-teal-300 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-bold text-slate-900">
        Original customer reviews
      </h2>

      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        These {reviews.length} original customer reviews are the
        source evidence for the managerial insight briefs below.
        Refer to them when evaluating groundedness, coverage,
        and actionability.
      </p>

      <details className="mt-4" open>
        <summary className="cursor-pointer rounded-md bg-teal-50 px-4 py-3 font-semibold text-teal-900">
          View source reviews ({reviews.length})
        </summary>

        <div className="mt-3 max-h-[500px] space-y-3 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3">
          {reviews.map((review) => (
            <article
              key={review.position}
              className="rounded-md border border-slate-200 bg-white p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Review {review.position}
                </h3>

                {review.rating !== null && (
                  <span className="text-sm font-semibold text-amber-700">
                    ★ {review.rating}/5
                  </span>
                )}
              </div>

              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {review.text}
              </p>
            </article>
          ))}
        </div>
      </details>
    </section>
  )
}
