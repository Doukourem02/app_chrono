import MapboxCoreNavigation
import MapboxDirections
import MapboxMaps
import MapboxNavigation

extension UIView {
  var parentViewController: UIViewController? {
    var parentResponder: UIResponder? = self
    while parentResponder != nil {
      parentResponder = parentResponder!.next
      if let viewController = parentResponder as? UIViewController {
        return viewController
      }
    }
    return nil
  }
}

class MapboxNavigationView: UIView, NavigationViewControllerDelegate {
  var navViewController: NavigationViewController?
  var navigationRouteOptions: NavigationRouteOptions!
  var embedded: Bool
  var embedding: Bool

  @objc var origin: NSArray = [] {
    didSet { if origin.count == 2 && destination.count == 2 { requestRoute() } }
  }
  @objc var destination: NSArray = [] {
    didSet { if origin.count == 2 && destination.count == 2 { requestRoute() } }
  }
  @objc var shouldSimulateRoute: Bool = false
  @objc var showsEndOfRouteFeedback: Bool = false
  @objc var hideStatusView: Bool = false
  @objc var mute: Bool = false

  @objc var onLocationChange: RCTDirectEventBlock?
  @objc var onRouteProgressChange: RCTDirectEventBlock?
  @objc var onError: RCTDirectEventBlock?
  @objc var onCancelNavigation: RCTDirectEventBlock?
  @objc var onArrive: RCTDirectEventBlock?

  override init(frame: CGRect) {
    self.embedded = false
    self.embedding = false
    super.init(frame: frame)
  }

  required init?(coder aDecoder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layoutSubviews() {
    super.layoutSubviews()

    // Ne pas embed tant que la vue n'a pas de dimensions valides (évite crash "Invalid size")
    let hasValidBounds = bounds.width >= 64 && bounds.height >= 64
    if !embedding && !embedded && origin.count == 2 && destination.count == 2 && hasValidBounds {
      embed()
    } else if let vc = navViewController {
      vc.view.frame = bounds
      hideResumeButton(in: vc.view)
    }
  }

  override func removeFromSuperview() {
    super.removeFromSuperview()
    navViewController?.willMove(toParent: nil)
    navViewController?.view.removeFromSuperview()
    navViewController?.removeFromParent()
    navViewController = nil
  }

  private func embed() {
    guard origin.count == 2 && destination.count == 2 else { return }
    guard let _ = parentViewController else { return }

    embedding = true

    let originWaypoint = Waypoint(coordinate: CLLocationCoordinate2D(
      latitude: (origin[1] as? CLLocationDegrees) ?? 0,
      longitude: (origin[0] as? CLLocationDegrees) ?? 0
    ))
    let destinationWaypoint = Waypoint(coordinate: CLLocationCoordinate2D(
      latitude: (destination[1] as? CLLocationDegrees) ?? 0,
      longitude: (destination[0] as? CLLocationDegrees) ?? 0
    ))

    let waypointsArray = [originWaypoint, destinationWaypoint]
    var options = NavigationRouteOptions(waypoints: waypointsArray, profileIdentifier: .automobileAvoidingTraffic)
    options.locale = Locale(identifier: "fr_FR")
    options.distanceMeasurementSystem = .metric

    Directions.shared.calculate(options) { [weak self] (_, result) in
      guard let strongSelf = self, let parentVC = strongSelf.parentViewController else {
        self?.embedding = false
        return
      }

      switch result {
      case .failure(let error):
        strongSelf.onError?(["message": error.localizedDescription])
        strongSelf.embedding = false
      case .success(let response):
        guard response.routes?.first != nil else {
          strongSelf.onError?(["message": "No route found"])
          strongSelf.embedding = false
          strongSelf.embedded = true
          return
        }

        let navigationService = MapboxNavigationService(
          routeResponse: response,
          routeIndex: 0,
          routeOptions: options,
          simulating: strongSelf.shouldSimulateRoute ? .always : .never
        )
        let navigationOptions = NavigationOptions(
          styles: [ChronoDayStyle(), ChronoNightStyle()],
          navigationService: navigationService
        )
        let vc = NavigationViewController(
          for: response,
          routeIndex: 0,
          routeOptions: options,
          navigationOptions: navigationOptions
        )

        vc.showsEndOfRouteFeedback = strongSelf.showsEndOfRouteFeedback
        vc.showsReportFeedback = false
        StatusView.appearance().isHidden = strongSelf.hideStatusView
        NavigationSettings.shared.voiceMuted = strongSelf.mute
        NavigationSettings.shared.distanceUnit = .kilometer
        vc.delegate = strongSelf

        parentVC.addChild(vc)
        strongSelf.addSubview(vc.view)
        vc.view.frame = strongSelf.bounds
        vc.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        vc.didMove(toParent: parentVC)
        strongSelf.navViewController = vc

        // Masquer les boutons natifs (boussole, recentrer) et "Tun pada" (Reprendre)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
          strongSelf.hideNativeFloatingButtons(in: vc.view)
          strongSelf.hideResumeButton(in: vc.view)
          strongSelf.hideMapOrnaments(in: vc)
        }
      }

      strongSelf.embedding = false
      strongSelf.embedded = true
    }
  }

  private func requestRoute() {
    if embedded || embedding { return }
    embed()
  }

  /// Masque les boutons natifs Mapbox (boussole, recentrer) qui ont le cercle blanc au centre
  private func hideNativeFloatingButtons(in view: UIView) {
    for subview in view.subviews {
      if String(describing: type(of: subview)).contains("FloatingButton") {
        subview.isHidden = true
      }
      hideNativeFloatingButtons(in: subview)
    }
  }

  /// Masque les ornements de la carte (boussole, barre d'échelle) - app ivoirienne, UI épurée
  private func hideMapOrnaments(in vc: NavigationViewController) {
    guard let mapView = vc.navigationMapView?.mapView else { return }
    var opts = mapView.ornaments.options
    opts.compass.visibility = .hidden
    opts.scaleBar.visibility = .hidden
    mapView.ornaments.options = opts
  }

  /// Masque le bouton Resume (Tun pada, Atunjade, etc.) - tout en français pour Côte d'Ivoire
  private func hideResumeButton(in view: UIView) {
    let typeName = String(describing: type(of: view))
    if typeName.contains("ResumeButton") {
      view.isHidden = true
      return
    }
    if let btn = view as? UIButton {
      let title = (btn.title(for: .normal) ?? btn.title(for: .selected) ?? "").lowercased()
      let resumeTerms = ["tun pada", "atunjade", "resume", "reprendre", "continue", "retry", "réessayer"]
      if resumeTerms.contains(where: { title.contains($0) }) {
        view.isHidden = true
        return
      }
    }
    if let label = view as? UILabel {
      let text = (label.text ?? "").lowercased()
      if !text.isEmpty {
        let resumeTerms = ["tun pada", "atunjade", "resume", "reprendre", "continue", "retry", "réessayer"]
        if resumeTerms.contains(where: { text.contains($0) }) {
          view.superview?.isHidden = true
          return
        }
      }
    }
    for subview in view.subviews {
      hideResumeButton(in: subview)
    }
  }

  func navigationViewController(
    _ navigationViewController: NavigationViewController, didUpdate progress: RouteProgress,
    with location: CLLocation, rawLocation: CLLocation
  ) {
    onLocationChange?([
      "longitude": location.coordinate.longitude, "latitude": location.coordinate.latitude,
    ])
    onRouteProgressChange?([
      "distanceTraveled": progress.distanceTraveled,
      "durationRemaining": progress.durationRemaining,
      "fractionTraveled": progress.fractionTraveled,
      "distanceRemaining": progress.distanceRemaining,
    ])
  }

  func navigationViewControllerDidDismiss(
    _ navigationViewController: NavigationViewController, byCanceling canceled: Bool
  ) {
    if !canceled {
      return
    }
    onCancelNavigation?(["message": ""])
  }

  func navigationViewController(
    _ navigationViewController: NavigationViewController, didArriveAt waypoint: Waypoint
  ) -> Bool {
    onArrive?(["message": ""])
    return true
  }
}

// MARK: - Styles personnalisés (thème sombre type référence, adapté Côte d'Ivoire)
private let chronoBlue = UIColor(red: 0.16, green: 0.41, blue: 0.86, alpha: 1)    // Bannière bleue
private let chronoDarkBg = UIColor(red: 0.14, green: 0.14, blue: 0.18, alpha: 0.9) // Boutons gris foncé
private let chronoWhite = UIColor.white

class ChronoDayStyle: DayStyle {
  required init() {
    super.init()
    styleType = .day
    if let url = URL(string: "mapbox://styles/mapbox/streets-v12") { mapStyleURL = url }
  }
  override func apply() {
    super.apply()
    let traitCollection = UIScreen.main.traitCollection
    TopBannerView.appearance(for: traitCollection).backgroundColor = chronoBlue
    InstructionsBannerView.appearance(for: traitCollection).backgroundColor = chronoBlue
    ManeuverView.appearance(for: traitCollection).backgroundColor = chronoBlue
    NextBannerView.appearance(for: traitCollection).backgroundColor = chronoBlue
    FloatingButton.appearance(for: traitCollection).backgroundColor = chronoDarkBg
    FloatingButton.appearance(for: traitCollection).tintColor = chronoWhite
    NavigationMapView.appearance(for: traitCollection).tintColor = chronoBlue
  }
}

class ChronoNightStyle: NightStyle {
  required init() {
    super.init()
    styleType = .night
    if let url = URL(string: "mapbox://styles/mapbox/dark-v11") { mapStyleURL = url }
  }
  override func apply() {
    super.apply()
    let traitCollection = UIScreen.main.traitCollection
    TopBannerView.appearance(for: traitCollection).backgroundColor = chronoBlue
    InstructionsBannerView.appearance(for: traitCollection).backgroundColor = chronoBlue
    ManeuverView.appearance(for: traitCollection).backgroundColor = chronoBlue
    NextBannerView.appearance(for: traitCollection).backgroundColor = chronoBlue
    BottomBannerView.appearance(for: traitCollection).backgroundColor = chronoDarkBg
    FloatingButton.appearance(for: traitCollection).backgroundColor = chronoDarkBg
    FloatingButton.appearance(for: traitCollection).tintColor = chronoWhite
    NavigationMapView.appearance(for: traitCollection).tintColor = chronoBlue
  }
}
