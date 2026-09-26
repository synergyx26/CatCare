require "rails_helper"

RSpec.describe CatAppearance::Suggester do
  # Synthetic "photos": a background colour in the border, and the cat's
  # colours (in the given proportions) in the centre.
  def pixels(spec, total: 600)
    spec.flat_map { |rgb, share| Array.new((total * share).round) { rgb } }
  end

  def c(name)
    {
      green_bg:    [120, 170, 110],
      black:       [30, 30, 34],
      white:       [240, 240, 236],
      orange:      [225, 135, 55],
      dark_orange: [170, 90, 35],
      gray:        [140, 144, 150],
      cream:       [236, 220, 196],
      brown:       [95, 65, 45],
    }.fetch(name)
  end

  def suggest(center, border: pixels({ c(:green_bg) => 1.0 }, total: 300))
    described_class.new(center_pixels: center, border_pixels: border).call
  end

  def hex_to_rgb(hex) = hex.delete("#").scan(/../).map { |h| h.to_i(16) }

  it "returns nil when there are no pixels" do
    expect(described_class.new(center_pixels: [], border_pixels: []).call).to be_nil
  end

  it "suggests a tuxedo for a black and white cat" do
    result = suggest(pixels({ c(:black) => 0.55, c(:white) => 0.3, c(:green_bg) => 0.15 }))
    expect(result["pattern"]).to eq("tuxedo")
    expect(hex_to_rgb(result["fur"]).max).to be < 60
    expect(hex_to_rgb(result["fur2"]).min).to be > 200
  end

  it "suggests a calico when orange, black and white all show up" do
    result = suggest(pixels({ c(:white) => 0.4, c(:orange) => 0.25, c(:black) => 0.2, c(:green_bg) => 0.15 }))
    expect(result).to include("pattern" => "calico")
    expect(result.keys).to include("fur2", "fur3")
  end

  it "suggests a tortoiseshell for orange and black without white" do
    result = suggest(pixels({ c(:black) => 0.5, c(:orange) => 0.35, c(:green_bg) => 0.15 }))
    expect(result["pattern"]).to eq("tortoiseshell")
  end

  it "suggests a tabby with darker stripes for a two-tone ginger" do
    result = suggest(pixels({ c(:orange) => 0.55, c(:dark_orange) => 0.3, c(:green_bg) => 0.15 }))
    expect(result["pattern"]).to eq("tabby")
    fur, stripes = hex_to_rgb(result["fur"]), hex_to_rgb(result["fur2"])
    expect(stripes.sum).to be < fur.sum
    expect(fur[0]).to be > fur[2] # still orange, not the green background
  end

  it "suggests a colorpoint for a cream cat with dark points" do
    result = suggest(pixels({ c(:cream) => 0.6, c(:brown) => 0.25, c(:green_bg) => 0.15 }))
    expect(result["pattern"]).to eq("colorpoint")
    expect(result["eyes"]).to eq(described_class::EYES[:cream])
  end

  it "suggests a bicolor for a grey and white cat" do
    result = suggest(pixels({ c(:gray) => 0.55, c(:white) => 0.3, c(:green_bg) => 0.15 }))
    expect(result).to include("pattern" => "bicolor")
    expect(hex_to_rgb(result["fur2"]).min).to be > 200
  end

  it "ignores the background colour that dominates the border" do
    result = suggest(pixels({ c(:green_bg) => 0.45, c(:gray) => 0.55 }))
    expect(result["pattern"]).to eq("solid")
    r, g, b = hex_to_rgb(result["fur"])
    expect((g - r).abs).to be < 25 # grey, not green
    expect((g - b).abs).to be < 25
  end

  it "still answers when the cat fills the whole frame" do
    whole = pixels({ c(:gray) => 1.0 })
    result = suggest(whole, border: whole)
    expect(result["pattern"]).to eq("solid")
  end

  it "only returns keys the Cat model accepts, with valid colours" do
    result = suggest(pixels({ c(:white) => 0.4, c(:orange) => 0.25, c(:black) => 0.2, c(:green_bg) => 0.15 }))
    cat = build(:cat, appearance: result)
    expect(cat).to be_valid
  end
end
