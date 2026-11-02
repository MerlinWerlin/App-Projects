import UIKit
import CoreImage

/// Curated clock art is already a finished background: never key or feather away its material.
/// Shared by the app bridge and the native review harness.
enum ClockArtRenderer {
  static func render(image: UIImage, width: CGFloat, height: CGFloat, colour: String) -> UIImage {
    let factor = min(1, 1200 / max(width,height))
    let size = CGSize(width:max(1,(width*factor).rounded()),height:max(1,(height*factor).rounded()))
    let canvas = CGRect(origin:.zero,size:size)
    let fit = min(size.width/image.size.width,size.height/image.size.height)
    let fill = max(size.width/image.size.width,size.height/image.size.height)
    let artSize = CGSize(width:image.size.width*fit,height:image.size.height*fit)
    let matching = min(image.size.width/image.size.height,size.width/size.height)/max(image.size.width/image.size.height,size.width/size.height) >= 0.98
    let artRect = matching ? canvas : CGRect(x:(size.width-artSize.width)/2,y:(size.height-artSize.height)/2,width:artSize.width,height:artSize.height)
    let format=UIGraphicsImageRendererFormat();format.scale=1;format.opaque=true
    // Blur only supplies the otherwise empty aspect-ratio strips. The foreground stays whole.
    var blurred: UIImage? = nil
    if !matching, let ci=CIImage(image:image) {
      let output=ci.clampedToExtent().applyingFilter("CIGaussianBlur",parameters:[kCIInputRadiusKey:max(image.size.width,image.size.height)*0.08]).cropped(to:ci.extent)
      if let cg=CIContext(options:nil).createCGImage(output,from:ci.extent) { blurred=UIImage(cgImage:cg) }
    }
    let n=UInt32(colour.dropFirst(),radix:16) ?? 0x15191C
    let base=UIColor(red:CGFloat((n>>16)&255)/255,green:CGFloat((n>>8)&255)/255,blue:CGFloat(n&255)/255,alpha:1)
    return UIGraphicsImageRenderer(size:size,format:format).image { ctx in
      base.setFill();ctx.fill(canvas)
      if let blurred=blurred {
        let w=image.size.width*fill,h=image.size.height*fill
        blurred.draw(in:CGRect(x:(size.width-w)/2,y:(size.height-h)/2,width:w,height:h))
      }
      image.draw(in:artRect)
    }
  }
}
