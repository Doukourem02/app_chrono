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
    let options = NavigationRouteOptions(waypoints: waypointsArray, profileIdentifier: .automobileAvoidingTraffic)

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
        let navigationOptions = NavigationOptions(navigationService: navigationService)
        let vc = NavigationViewController(
          for: response,
          routeIndex: 0,
          routeOptions: options,
          navigationOptions: navigationOptions
        )

        vc.showsEndOfRouteFeedback = strongSelf.showsEndOfRouteFeedback
        StatusView.appearance().isHidden = strongSelf.hideStatusView
        NavigationSettings.shared.voiceMuted = strongSelf.mute
        vc.delegate = strongSelf

        parentVC.addChild(vc)
        strongSelf.addSubview(vc.view)
        vc.view.frame = strongSelf.bounds
        vc.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        vc.didMove(toParent: parentVC)
        strongSelf.navViewController = vc
      }

      strongSelf.embedding = false
      strongSelf.embedded = true
    }
  }

  private func requestRoute() {
    if embedded || embedding { return }
    embed()
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
