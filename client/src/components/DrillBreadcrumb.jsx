import { Breadcrumb } from 'antd';

function DrillBreadcrumb({ items, onNavigate }) {
  return (
    <Breadcrumb
      className="drill-breadcrumb"
      items={items.map((item, index) => {
        const current = index === items.length - 1;
        return {
          key: item.key,
          title: current ? item.label : (
            <button type="button" className="crumb-button" onClick={() => onNavigate(item.key)}>
              {item.label}
            </button>
          ),
        };
      })}
    />
  );
}

export default DrillBreadcrumb;
