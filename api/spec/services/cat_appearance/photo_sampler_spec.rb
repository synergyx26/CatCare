require "rails_helper"

# Decoding needs libvips (installed in the API Docker image and in CI).
vips_available = begin
  require "vips"
  true
rescue LoadError
  false
end

RSpec.describe CatAppearance::PhotoSampler do
  before { skip "libvips not installed locally (brew install vips)" unless vips_available }

  def write_image(image, ext = ".png")
    file = Tempfile.new(["cat", ext])
    image.write_to_file(file.path)
    file
  end

  # 120×120 green background with a black square in the middle
  def cat_on_background
    background = (Vips::Image.black(120, 120, bands: 3) + [120, 170, 110]).cast(:uchar)
    cat = Vips::Image.black(50, 50, bands: 3).cast(:uchar)
    background.insert(cat, 35, 35)
  end

  it "samples the centre and the border separately" do
    file = write_image(cat_on_background)
    samples = described_class.new(file.path).call

    expect(samples[:center]).to include([0, 0, 0])
    expect(samples[:border]).to all(eq([120, 170, 110]))
    expect(samples[:center].size).to be > 0
  ensure
    file&.close!
  end

  it "handles greyscale and alpha images as RGB" do
    grey = (Vips::Image.black(40, 40) + 128).cast(:uchar)
    with_alpha = grey.bandjoin(255)
    file = write_image(with_alpha)
    samples = described_class.new(file.path).call

    expect(samples[:center].first).to eq([128, 128, 128])
  ensure
    file&.close!
  end

  it "raises UnreadableImage for a file that isn't an image" do
    file = Tempfile.new(["not-a-cat", ".jpg"])
    file.write("definitely not a jpeg")
    file.flush

    expect { described_class.new(file.path).call }.to raise_error(described_class::UnreadableImage)
  ensure
    file&.close!
  end
end
