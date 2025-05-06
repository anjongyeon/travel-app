import React, { useEffect, useState, useRef } from 'react';
import './Map.css';

const { kakao } = window;
const Map = () => {

  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [pointObj, setPointObj] = useState({
    startPoint: { marker: null, lat: null, lng: null },
    endPoint: { marker: null, lat: null, lng: null }
  });
  const [polyline, setPolyline] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return; 

    const mapOptions = {
      center: new kakao.maps.LatLng(35.1575, 126.8476), 
      level: 3 
    };

    const kakaoMap = new kakao.maps.Map(mapContainer, mapOptions);
    const zoomControl = new kakao.maps.ZoomControl();
    kakaoMap.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);

    setMap(kakaoMap);
    mapRef.current = kakaoMap;
  }, []); 

  useEffect(() => {
    if (!map) return; 
    for (const point in pointObj) {
      if (pointObj[point].marker) {
        pointObj[point].marker.setMap(map);
      }
    }
  }, [pointObj, map]);

  const searchPlaces = () => {
    if (!map || !searchKeyword.trim()) {
      alert('검색어를 입력하세요!');
      return;
    }

    setSearching(true);

    setSearchResults([]);

    const places = new kakao.maps.services.Places();

    places.keywordSearch(searchKeyword, (result, status) => {
      if (status === kakao.maps.services.Status.OK) {
        console.log('검색 결과:', result);
        setSearchResults(result);
      } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
        alert('검색 결과가 존재하지 않습니다.');
      } else if (status === kakao.maps.services.Status.ERROR) {
        alert('검색 중 오류가 발생했습니다.');
      }
      setSearching(false);
    });
  };

  const moveToPlace = (place) => {
    const lat = parseFloat(place.y);
    const lng = parseFloat(place.x);
    panTo({ lat, lng });
  };

  const selectSearchResult = (place, pointType) => {
    const lat = parseFloat(place.y);
    const lng = parseFloat(place.x);
    setPoint({ lat, lng }, pointType);
    panTo({ lat, lng });
  };

  function panTo({ lat, lng }) {
    if (!mapRef.current) return;
    const moveLatLon = new kakao.maps.LatLng(lat, lng);
    mapRef.current.panTo(moveLatLon);
  }

  function setPoint({ lat, lng }, pointType) {
    if (!mapRef.current) return;

    const imageSrc = pointType === 'startPoint'
      ? '//t1.daumcdn.net/localimg/localimages/07/mapapidoc/red_b.png'
      : '//t1.daumcdn.net/localimg/localimages/07/mapapidoc/blue_b.png';

    const imageSize = new kakao.maps.Size(50, 45);

    const imageOption = { offset: new kakao.maps.Point(15, 43) };

    const markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize, imageOption);

    let marker = new kakao.maps.Marker({
      position: new kakao.maps.LatLng(lat, lng),
      image: markerImage 
    });
   
    setPointObj(prev => {
      if (prev[pointType].marker !== null) {
        prev[pointType].marker.setMap(null);
      }
      return { ...prev, [pointType]: { marker, lat, lng } };
    });

    if (polyline) {
      polyline.setMap(null);
      setPolyline(null);
    }
  }

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          panTo({ lat, lng });
          setPoint({ lat, lng }, 'startPoint');
        },
        (error) => {
          console.error('현재 위치 오류:', error);
          alert('현재 위치를 가져오는데 실패했습니다.');
        }
      );
    } else {
      alert('브라우저에서 위치 정보를 지원하지 않습니다.');
    }
  };

  async function getCarDirection() {
    if (!mapRef.current) return; 
    if (!pointObj.startPoint.lat || !pointObj.endPoint.lat) {
      alert('출발지와 목적지를 모두 설정해주세요.');
      return;
    }

    try {
      const REST_API_KEY = '1d1a7b61f8e198ed62917833f4731ada'; 
      const url = 'https://apis-navi.kakaomobility.com/v1/directions';

      const origin = `${pointObj.startPoint.lng},${pointObj.startPoint.lat}`;
      const destination = `${pointObj.endPoint.lng},${pointObj.endPoint.lat}`;
      const headers = {
        Authorization: `KakaoAK ${REST_API_KEY}`,
        'Content-Type': 'application/json'
      };
      const queryParams = new URLSearchParams({
        origin,
        destination
      });
      const requestUrl = `${url}?${queryParams}`;
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = await response.json();

      const linePath = [];

      data.routes[0].sections[0].roads.forEach(road => {
        road.vertexes.forEach((vertex, index) => {
          if (index % 2 === 0) {
            linePath.push(new kakao.maps.LatLng(road.vertexes[index + 1], road.vertexes[index]));
          }
        });
      });

      if (polyline) polyline.setMap(null);

      const newPolyline = new kakao.maps.Polyline({
        path: linePath, 
        strokeWeight: 5,
        strokeColor: '#0000FF', 
        strokeOpacity: 0.7, 
        strokeStyle: 'solid' 
      });

      newPolyline.setMap(mapRef.current);
      setPolyline(newPolyline);

      const bounds = new kakao.maps.LatLngBounds();
      linePath.forEach(point => bounds.extend(point));
      mapRef.current.setBounds(bounds);

    } catch (error) {
      console.error('경로 가져오기 오류:', error);
      showStraightRoute();
    }
  }

  function showStraightRoute() {
    if (!mapRef.current || !pointObj.startPoint.lat || !pointObj.endPoint.lat) {
      alert('출발지와 목적지를 모두 설정해주세요.');
      return;
    }

    if (polyline) {
      polyline.setMap(null);
    }

    const linePath = [
      new kakao.maps.LatLng(pointObj.startPoint.lat, pointObj.startPoint.lng),
      new kakao.maps.LatLng(pointObj.endPoint.lat, pointObj.endPoint.lng)
    ];

    const newPolyline = new kakao.maps.Polyline({
      path: linePath,
      strokeWeight: 5,
      strokeColor: '#FF0000', 
      strokeOpacity: 0.7,
      strokeStyle: 'solid'
    });

    newPolyline.setMap(mapRef.current);
    setPolyline(newPolyline);

    const bounds = new kakao.maps.LatLngBounds();
    bounds.extend(linePath[0]);
    bounds.extend(linePath[1]);
    mapRef.current.setBounds(bounds);
  }

  const resetAll = () => {
    for (const point in pointObj) {
      if (pointObj[point].marker !== null) {
        pointObj[point].marker.setMap(null);
      }
    }

    if (polyline) polyline.setMap(null);

    setPointObj({
      startPoint: { marker: null, lat: null, lng: null },
      endPoint: { marker: null, lat: null, lng: null }
    });
    setPolyline(null);
    setSearchResults([]);
    setSearchKeyword('');
  };

  return (
    <div className="map-container">
      <div id="map" className="map"></div>
      <div className="search-panel">
        <h2>장소 검색</h2>

        <div className="search-form">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="장소를 입력하세요"
            onKeyPress={(e) => e.key === 'Enter' && searchPlaces()}
          />
          <button onClick={searchPlaces} disabled={searching}>
            {searching ? '검색 중...' : '검색하기'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="search-results">
            <h3>검색 결과</h3>
            <ul>
              {searchResults.map((place, index) => (
                <li key={index}>
                  <div className="place-info" onClick={() => moveToPlace(place)}>
                    <strong>{place.place_name}</strong>
                    <p>{place.address_name}</p>
                  </div>
                  <div className="place-actions">
                    <button onClick={() => selectSearchResult(place, 'startPoint')}>
                      출발지로 설정
                    </button>
                    <button onClick={() => selectSearchResult(place, 'endPoint')}>
                      목적지로 설정
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="route-actions">
          <h3>경로 찾기</h3>
          <div className="location-status">
            <div className="location-point">
              <span className="point-label">출발지:</span>
              <span className="point-value">
                {pointObj.startPoint.lat ? '설정됨' : '미설정'}
              </span>
            </div>

            <div className="location-point">
              <span className="point-label">목적지:</span>
              <span className="point-value">
                {pointObj.endPoint.lat ? '설정됨' : '미설정'}
              </span>
            </div>
          </div>
          <div className="action-buttons">
            <button
              className="route-button"
              onClick={getCurrentLocation}
            >
              현재 위치
            </button>
            <button
              className="route-button"
              onClick={getCarDirection}
              disabled={!pointObj.startPoint.lat || !pointObj.endPoint.lat}
            >
              경로 찾기
            </button>
            <button
              className="reset-button"
              onClick={resetAll}
            >
              초기화
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Map;