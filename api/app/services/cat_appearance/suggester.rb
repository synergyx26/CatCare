module CatAppearance
  # Turns pixel samples from a cat photo into a suggested cartoon appearance
  # ({ "pattern", "fur", "fur2", "fur3", "eyes" } — see Cat::APPEARANCE_KEYS).
  #
  # Pure Ruby on [r, g, b] arrays so it's testable without libvips; decoding
  # the photo is PhotoSampler's job.
  #
  # Method: k-means the centre of the photo into a few colour clusters, drop
  # clusters that dominate the photo's border (likely background), name each
  # remaining cluster (black/white/grey/orange/cream/brown) and pick a pattern
  # from which names are present. This is a best guess — the user can change
  # any of it in the editor — so it favours plausible over precise.
  class Suggester
    SIGNIFICANT_SHARE = 0.12
    BACKGROUND_PENALTY = 0.7
    MIN_FUR_SCORE = 0.06
    ITERATIONS = 10

    # Cartoon-friendly target per colour name; the measured colour is blended
    # toward it so shadows and white balance don't make the cat look muddy.
    IDEALS = {
      black:  [47, 48, 54],
      white:  [245, 243, 238],
      gray:   [158, 166, 179],
      orange: [240, 160, 80],
      cream:  [238, 220, 192],
      brown:  [138, 90, 58],
    }.freeze
    IDEAL_BLEND = 0.3

    EYES = {
      black:  "#f2c94c",
      white:  "#6fa8dc",
      gray:   "#7cbf5a",
      orange: "#c98a2b",
      cream:  "#4a90d9",
      brown:  "#c98a2b",
    }.freeze

    def initialize(center_pixels:, border_pixels: [], k: 5)
      @center = center_pixels
      @border = border_pixels
      @k = k
    end

    # Returns nil when there's nothing to analyse.
    def call
      return nil if @center.empty?

      clusters = fur_clusters
      named = clusters.map { |c| c.merge(name: name_for(c[:color])) }
      build_appearance(named)
    end

    private

    # ── Clustering ───────────────────────────────────────────────────────────

    def fur_clusters
      centroids = kmeans(@center, @k)
      counts = Array.new(centroids.size, 0)
      @center.each { |px| counts[nearest(px, centroids)] += 1 }

      border_counts = Array.new(centroids.size, 0)
      @border.each { |px| border_counts[nearest(px, centroids)] += 1 }

      clusters = centroids.each_with_index.map do |color, i|
        share = counts[i].to_f / @center.size
        border_share = @border.empty? ? 0.0 : border_counts[i].to_f / @border.size
        { color: color, share: share, score: share - BACKGROUND_PENALTY * border_share }
      end.select { |c| c[:share] > 0 }

      fur = clusters.select { |c| c[:score] >= MIN_FUR_SCORE }
      # Cat fills the whole frame (border looks like the centre): keep everything.
      fur = clusters if fur.empty?

      total = fur.sum { |c| c[:share] }
      fur.map { |c| c.merge(share: c[:share] / total) }.sort_by { |c| -c[:share] }
    end

    # Deterministic farthest-point init over common colours: start from the
    # most common colour, then repeatedly add the common colour farthest from
    # every centroid so far. Keeps distinct colours (e.g. background vs fur)
    # from sharing a starting centroid; "common" (≥1% of pixels, in 16-level
    # bins) stops a few stray highlight pixels from claiming a slot.
    def kmeans(pixels, k)
      bins = pixels.group_by { |r, g, b| [r >> 4, g >> 4, b >> 4] }
      common = bins.values.select { |px| px.size >= pixels.size * 0.01 }
      common = bins.values if common.empty?
      candidates = common.sort_by { |px| -px.size }.map { |px| mean(px) }
      k = [k, candidates.size].min

      centroids = [candidates.first]
      while centroids.size < k
        centroids << candidates.max_by { |c| centroids.map { |x| distance2(c, x) }.min }
      end

      ITERATIONS.times do
        sums = Array.new(k) { [0.0, 0.0, 0.0, 0] }
        pixels.each do |px|
          s = sums[nearest(px, centroids)]
          s[0] += px[0]; s[1] += px[1]; s[2] += px[2]; s[3] += 1
        end
        centroids = sums.each_with_index.map do |(r, g, b, n), i|
          n.zero? ? centroids[i] : [r / n, g / n, b / n]
        end
      end
      centroids.map { |c| c.map(&:round) }
    end

    def mean(pixels)
      (0..2).map { |i| pixels.sum { |px| px[i] }.to_f / pixels.size }
    end

    def distance2(a, b) = (a[0] - b[0])**2 + (a[1] - b[1])**2 + (a[2] - b[2])**2

    def nearest(px, centroids)
      best = 0
      best_d = Float::INFINITY
      centroids.each_with_index do |c, i|
        d = distance2(px, c)
        if d < best_d
          best_d = d
          best = i
        end
      end
      best
    end

    # ── Naming ───────────────────────────────────────────────────────────────

    def name_for((r, g, b))
      max = [r, g, b].max
      min = [r, g, b].min
      l = luma([r, g, b])
      sat = max.zero? ? 0.0 : (max - min).to_f / max

      return :black if l < 60

      # Warm-tinted fur first, so cream isn't mistaken for white
      if sat >= 0.12 && warm_hue?(hue(r, g, b, max, min))
        return :cream if l > 170 && sat < 0.45
        return :brown if l < 110
        return :orange
      end

      return :white if l > 185
      :gray
    end

    def warm_hue?(h) = h < 55 || h >= 340

    def hue(r, g, b, max, min)
      return 0.0 if max == min
      d = (max - min).to_f
      h = if max == r then ((g - b) / d) % 6
          elsif max == g then ((b - r) / d) + 2
          else ((r - g) / d) + 4
          end
      h * 60
    end

    def luma((r, g, b)) = 0.299 * r + 0.587 * g + 0.114 * b

    # ── Pattern ──────────────────────────────────────────────────────────────

    def build_appearance(clusters)
      shares = Hash.new(0.0)
      clusters.each { |c| shares[c[:name]] += c[:share] }
      sig = ->(name) { shares[name] >= SIGNIFICANT_SHARE }
      warm = %i[orange cream brown].select { |n| sig.(n) }.max_by { |n| shares[n] }
      dominant = shares.max_by { |_, v| v }.first

      # base = colour name of the main coat (drives the default eye colour)
      pattern, base, fur2, fur3 =
        if sig.(:orange) && sig.(:black) && sig.(:white)
          ["calico", :white, color(clusters, :orange), color(clusters, :black)]
        elsif warm && sig.(:black) && !sig.(:white)
          ["tortoiseshell", :black, color(clusters, warm), nil]
        elsif sig.(:black) && sig.(:white)
          ["tuxedo", :black, color(clusters, :white), nil]
        elsif dominant == :cream && (sig.(:brown) || sig.(:black))
          ["colorpoint", :cream, color(clusters, sig.(:brown) ? :brown : :black), nil]
        elsif sig.(:white) && dominant != :white
          ["bicolor", dominant, color(clusters, :white), nil]
        elsif (stripes = tabby_stripes(clusters, dominant))
          ["tabby", dominant, stripes, nil]
        elsif %i[orange brown].include?(dominant)
          # Ginger and brown cats are almost always tabbies.
          ["tabby", dominant, shade(color(clusters, dominant), 0.72), nil]
        else
          ["solid", dominant, nil, nil]
        end

      {
        "pattern" => pattern,
        "fur"     => color(clusters, base),
        "fur2"    => fur2,
        "fur3"    => fur3,
        "eyes"    => EYES.fetch(base),
      }.compact
    end

    # Two clusters sharing the dominant colour name but clearly different in
    # lightness read as stripes on a lighter base.
    def tabby_stripes(clusters, dominant)
      same = clusters.select { |c| c[:name] == dominant && c[:share] >= 0.1 }
      return nil if same.size < 2
      light, dark = same.max_by(2) { |c| c[:share] }.sort_by { |c| -luma(c[:color]) }
      return nil if luma(light[:color]) - luma(dark[:color]) < 35
      idealize(dark[:color], dominant)
    end

    # Share-weighted mean of every cluster with this name, nudged to the ideal.
    def color(clusters, name)
      matching = clusters.select { |c| c[:name] == name }
      total = matching.sum { |c| c[:share] }
      mean = (0..2).map { |i| matching.sum { |c| c[:color][i] * c[:share] } / total }
      idealize(mean, name)
    end

    def idealize(rgb, name)
      ideal = IDEALS.fetch(name)
      hex(rgb.each_with_index.map { |v, i| v * (1 - IDEAL_BLEND) + ideal[i] * IDEAL_BLEND })
    end

    def shade(hex_color, factor)
      hex(hex_color.delete("#").scan(/../).map { |h| h.to_i(16) * factor })
    end

    def hex(rgb) = "#" + rgb.map { |v| v.round.clamp(0, 255).to_s(16).rjust(2, "0") }.join
  end
end
