module CatAppearance
  # Decodes a cat photo with libvips and returns pixel samples for Suggester:
  # the centre of the frame (where the cat usually is) and the outer border
  # (mostly background). Works on a small thumbnail, so it's cheap regardless
  # of the upload's size.
  class PhotoSampler
    class UnreadableImage < StandardError; end

    THUMBNAIL_SIZE = 96
    CENTER_X = (0.2..0.8)
    CENTER_Y = (0.2..0.85)
    BORDER = 0.1

    def self.from_blob(blob)
      blob.open { |file| new(file.path).call }
    rescue ActiveStorage::FileNotFoundError => e
      raise UnreadableImage, e.message
    end

    def initialize(path)
      @path = path
    end

    # => { center: [[r, g, b], …], border: [[r, g, b], …] }
    def call
      require "vips"

      image = Vips::Image.thumbnail(@path, THUMBNAIL_SIZE, height: THUMBNAIL_SIZE, size: :down)
      image = image.flatten(background: [255, 255, 255]) if image.has_alpha?
      image = image.colourspace(:srgb) unless image.interpretation == :srgb
      image = image.extract_band(0, n: 3) if image.bands > 3
      image = image.cast(:uchar)

      split(image.write_to_memory.unpack("C*").each_slice(3).to_a, image.width, image.height)
    rescue Vips::Error => e
      raise UnreadableImage, e.message
    end

    private

    def split(pixels, width, height)
      center = []
      border = []
      pixels.each_with_index do |px, i|
        x = (i % width).to_f / width
        y = (i / width).to_f / height
        if CENTER_X.cover?(x) && CENTER_Y.cover?(y)
          center << px
        elsif x < BORDER || x >= 1 - BORDER || y < BORDER || y >= 1 - BORDER
          border << px
        end
      end
      { center: center, border: border }
    end
  end
end
